import { loadShellEnv } from './services/shell-env'
import { app, shell, BrowserWindow, screen, ipcMain, clipboard } from 'electron'
import { dirname, join } from 'path'
import { exec, execFileSync } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, accessSync, constants } from 'fs'
import { electronApp, is } from '@electron-toolkit/utils'
import { getDatabase, closeDatabase } from './db'
import {
  registerDatabaseHandlers,
  registerProjectHandlers,
  registerWorktreeHandlers,
  registerOpenCodeHandlers,
  cleanupOpenCode,
  registerFileTreeHandlers,
  cleanupFileTreeWatchers,
  registerGitFileHandlers,
  cleanupWorktreeWatchers,
  cleanupBranchWatchers,
  registerSettingsHandlers,
  registerFileHandlers,
  registerScriptHandlers,
  cleanupScripts,
  registerTerminalHandlers,
  cleanupTerminals,
  registerUpdaterHandlers,
  registerConnectionHandlers,
  registerUsageHandlers,
  registerKanbanHandlers,
  registerOmxHandlers
} from './ipc'
import { buildMenu, updateMenuState } from './menu'
import type { MenuState } from './menu'
import { createLogger, getLogDir } from './services/logger'
import { detectAgentSdks } from './services/system-info'
import { createResponseLog, appendResponseLog } from './services/response-logger'
import { notificationService } from './services/notification-service'
import { updaterService } from './services/updater'
import { ClaudeCodeImplementer } from './services/claude-code-implementer'
import { CodexImplementer } from './services/codex-implementer'
import { OmxImplementer } from './services/omx-implementer'
import { AgentSdkManager } from './services/agent-sdk-manager'
import { resolveClaudeBinaryPath } from './services/claude-binary-resolver'
import type { AgentSdkImplementer } from './services/agent-sdk-types'
import { telemetryService } from './services/telemetry-service'
import { registerTicketImportHandlers } from './ipc/ticket-import-handlers'
import { initTicketProviderManager, GitHubProvider, JiraProvider } from './services/ticket-providers'
import { detectEditors, detectTerminals } from './services/settings-detection'
import { spawnDetached } from './services/spawn-detached'
import { cleanupOmxTmuxSessions } from './services/omx-service'
import { getCliArgs, getFlagValue, getNumericFlagValue } from './services/cli-args'
import {
  buildHiveServerScript,
  chooseLinuxInstallTarget,
  getLinuxUninstallCandidates,
  getUserHiveServerPath,
  SYSTEM_HIVE_SERVER_PATH
} from './services/hive-server-path'

const log = createLogger({ component: 'Main' })

const appStartTime = Date.now()

async function cleanupActiveOmxTmuxSessions(): Promise<void> {
  try {
    const activeOmxSessions = getDatabase()
      .getActiveSessionsByAgentSdk('omx')
      .map((session) => session.opencode_session_id)
    await cleanupOmxTmuxSessions(activeOmxSessions)
  } catch {
    // Best-effort cleanup — continue shutdown/window teardown
  }
}

// Parse CLI flags
const cliArgs = getCliArgs(process.argv, { isPackaged: app.isPackaged })
const isLogMode = cliArgs.includes('--log')
const isHeadless = cliArgs.includes('--headless')
const headlessPort = getNumericFlagValue(cliArgs, '--port', { min: 1, max: 65535 })
const headlessBind = getFlagValue(cliArgs, '--bind')
const isRotateKey = cliArgs.includes('--rotate-key')
const isRegenCerts = cliArgs.includes('--regen-certs')
const isShowStatus = cliArgs.includes('--show-status')
const isKill = cliArgs.includes('--kill')
const isUnlock = cliArgs.includes('--unlock')

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  isMaximized?: boolean
}

const BOUNDS_FILE = join(app.getPath('userData'), 'window-bounds.json')

function loadWindowBounds(): WindowBounds | null {
  try {
    if (existsSync(BOUNDS_FILE)) {
      const data = readFileSync(BOUNDS_FILE, 'utf-8')
      const bounds = JSON.parse(data) as WindowBounds

      // Validate that the bounds are still valid (screen might have changed)
      const displays = screen.getAllDisplays()
      const isOnScreen = displays.some((display) => {
        const { x, y, width, height } = display.bounds
        return (
          bounds.x >= x &&
          bounds.y >= y &&
          bounds.x + bounds.width <= x + width &&
          bounds.y + bounds.height <= y + height
        )
      })

      if (isOnScreen) {
        return bounds
      }
    }
  } catch {
    // Ignore errors, use defaults
  }
  return null
}

function saveWindowBounds(window: BrowserWindow): void {
  try {
    const bounds = window.getBounds()
    const isMaximized = window.isMaximized()

    // Ensure directory exists
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(BOUNDS_FILE, JSON.stringify({ ...bounds, isMaximized }))
  } catch {
    // Ignore save errors
  }
}

let mainWindow: BrowserWindow | null = null

function canWriteParentDir(targetPath: string): boolean {
  try {
    accessSync(dirname(targetPath), constants.W_OK)
    return true
  } catch {
    return false
  }
}

function hasCommand(command: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [command], {
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

function createWindow(): void {
  const savedBounds = loadWindowBounds()
  log.info('Creating main window', {
    platform: process.platform,
    savedBounds,
    initialShow: process.platform === 'linux'
  })

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1200,
    height: savedBounds?.height ?? 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 600,
    show: process.platform === 'linux',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 15, y: 10 }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Restore maximized state
  if (savedBounds?.isMaximized) {
    mainWindow.maximize()
  }

  if (!mainWindow.isVisible()) {
    mainWindow.on('ready-to-show', () => {
      log.info('Main window ready-to-show fired')
      mainWindow.show()
    })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Main window did-finish-load', { visible: mainWindow?.isVisible() })
  })

  mainWindow.on('show', () => {
    log.info('Main window show event', { visible: mainWindow?.isVisible() })
  })

  // Emit focus event to renderer for git refresh on window focus
  mainWindow.on('focus', () => {
    mainWindow!.webContents.send('app:windowFocused')
  })

  // Save window bounds on resize and move
  mainWindow.on('resize', () => saveWindowBounds(mainWindow))
  mainWindow.on('move', () => saveWindowBounds(mainWindow))
  mainWindow.on('close', () => saveWindowBounds(mainWindow))
  mainWindow.on('closed', () => {
    cleanupTerminals()
    void cleanupActiveOmxTmuxSessions()
  })

  // Intercept Cmd+T (macOS) / Ctrl+T (Windows/Linux) before Chromium consumes it
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key.toLowerCase() === 't' &&
      (input.meta || input.control) &&
      !input.alt &&
      !input.shift &&
      input.type === 'keyDown'
    ) {
      event.preventDefault()
      mainWindow!.webContents.send('shortcut:new-session')
    }

    // Intercept Cmd+D — forward to renderer to toggle file search dialog
    if (
      input.key.toLowerCase() === 'd' &&
      (input.meta || input.control) &&
      !input.alt &&
      !input.shift &&
      input.type === 'keyDown'
    ) {
      event.preventDefault()
      mainWindow!.webContents.send('shortcut:file-search')
    }

    // Intercept Cmd+W — never close the window, forward to renderer to close session tab
    if (
      input.key.toLowerCase() === 'w' &&
      (input.meta || input.control) &&
      !input.alt &&
      !input.shift &&
      input.type === 'keyDown'
    ) {
      event.preventDefault()
      mainWindow!.webContents.send('shortcut:close-session')
    }

    // Block zoom shortcuts — Ghostty native overlay requires 1:1 coordinate mapping.
    // Any zoom level breaks the CSS-to-AppKit point sync for the NSView overlay.
    if (
      (input.meta || input.control) &&
      !input.alt &&
      (input.key === '=' || input.key === '+' || input.key === '-') &&
      input.type === 'keyDown'
    ) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register system IPC handlers
function registerSystemHandlers(): void {
  // Get log directory path
  ipcMain.handle('system:getLogDir', () => {
    return getLogDir()
  })

  // Get app version
  ipcMain.handle('system:getAppVersion', () => {
    return app.getVersion()
  })

  // Get app paths
  ipcMain.handle('system:getAppPaths', () => {
    return {
      userData: app.getPath('userData'),
      home: app.getPath('home'),
      logs: getLogDir()
    }
  })

  // Check if response logging is enabled
  ipcMain.handle('system:isLogMode', () => isLogMode)

  // Open a URL in Chrome (or default browser) with optional custom command
  ipcMain.handle(
    'system:openInChrome',
    async (_event, { url, customCommand }: { url: string; customCommand?: string }) => {
      try {
        if (customCommand) {
          // If the command contains {url}, substitute it; otherwise append the URL
          const cmd = customCommand.includes('{url}')
            ? customCommand.replace(/\{url\}/g, url)
            : `${customCommand} ${url}`
          await new Promise<void>((resolve, reject) => {
            exec(cmd, (error) => {
              if (error) reject(error)
              else resolve()
            })
          })
        } else {
          await shell.openExternal(url)
        }
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Open a path in an external app (Cursor, Ghostty) or copy to clipboard
  ipcMain.handle('system:openInApp', async (_, appName: string, path: string) => {
    try {
      switch (appName) {
        case 'cursor':
          if (process.platform === 'darwin') {
            await spawnDetached('open', ['-a', 'Cursor', path])
          } else if (process.platform === 'win32') {
            await spawnDetached('cmd', ['/c', 'start', '', 'cursor', path])
          } else {
            const cursor = detectEditors().find((editor) => editor.id === 'cursor')
            if (!cursor?.available) {
              return { success: false, error: 'Cursor is not installed' }
            }
            await spawnDetached(cursor.command, [path])
          }
          break
        case 'ghostty':
          if (process.platform === 'win32') {
            return { success: false, error: 'Ghostty is not available on Windows' }
          }
          if (process.platform === 'darwin') {
            await spawnDetached('open', ['-a', 'Ghostty', path])
          } else {
            const ghostty = detectTerminals().find((terminal) => terminal.id === 'ghostty')
            if (!ghostty?.available) {
              return { success: false, error: 'Ghostty is not installed' }
            }
            await spawnDetached(ghostty.command, ['--working-directory=' + path])
          }
          break
        case 'android-studio':
          if (process.platform === 'darwin') {
            await spawnDetached('open', ['-a', 'Android Studio', path])
          } else if (process.platform === 'win32') {
            await spawnDetached('cmd', ['/c', 'start', '', 'studio64.exe', path])
          } else {
            const studioCommand = ['studio', 'android-studio'].find((candidate) =>
              hasCommand(candidate)
            )
            if (!studioCommand) {
              return { success: false, error: 'Android Studio is not installed' }
            }
            await spawnDetached(studioCommand, [path])
          }
          break
        case 'copy-path':
          clipboard.writeText(path)
          break
        default:
          return { success: false, error: `Unknown app: ${appName}` }
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open in app'
      }
    }
  })

  // Detect which agent SDKs are installed on the system (first-launch setup)
  ipcMain.handle('system:detectAgentSdks', () => {
    return detectAgentSdks()
  })

  // Quit the app (needed for macOS where window.close() doesn't quit)
  ipcMain.handle('system:quitApp', () => {
    app.quit()
  })

  // Check if the app is running in packaged mode (not dev)
  ipcMain.handle('system:isPackaged', () => {
    return app.isPackaged
  })

  // Get the current platform (darwin, win32, linux)
  ipcMain.handle('system:getPlatform', () => {
    return process.platform
  })

  // Install hive-server shell wrapper to PATH
  ipcMain.handle('system:installServerToPath', async () => {
    const execAsync = promisify(exec)
    const execPath = process.execPath
    const scriptContent = buildHiveServerScript(execPath)

    if (process.platform === 'win32') {
      try {
        const installDir = join(process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local'), 'Hive')
        mkdirSync(installDir, { recursive: true })
        const targetPath = join(installDir, 'hive-server.cmd')
        const scriptContent = `@echo off\r\n"${execPath}" --headless %*\r\n`
        writeFileSync(targetPath, scriptContent)

        // Add to user PATH via PowerShell if not already present (escape single quotes for safe interpolation)
        const escapedDir = installDir.replace(/'/g, "''")
        const psCmd = `$d='${escapedDir}'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if($p -split ';' -notcontains $d){ [Environment]::SetEnvironmentVariable('Path',$p+';'+$d,'User') }`
        await execAsync(`powershell -Command "${psCmd}"`, { timeout: 15000 })

        return { success: true, path: targetPath }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }

    if (process.platform === 'darwin') {
      const targetPath = SYSTEM_HIVE_SERVER_PATH
      try {
        const tmpPath = join(app.getPath('temp'), 'hive-server-install')
        writeFileSync(tmpPath, scriptContent, { mode: 0o755 })
        const osascript = `do shell script "mv '${tmpPath}' '${targetPath}' && chmod +x '${targetPath}'" with administrator privileges`
        await execAsync(`osascript -e '${osascript}'`, { timeout: 30000 })
        return { success: true, path: targetPath }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (
          message.includes('User canceled') ||
          message.includes('-128') ||
          message.includes('Not authorized')
        ) {
          return { success: false, error: 'Installation cancelled' }
        }
        return { success: false, error: message }
      }
    }

    // Linux
    try {
      const installPlan = chooseLinuxInstallTarget({
        canWriteSystemPath: canWriteParentDir(SYSTEM_HIVE_SERVER_PATH),
        hasPkexec: hasCommand('pkexec'),
        homeDir: app.getPath('home')
      })

      if (installPlan.requiresPrivilege) {
        const tmpPath = join(app.getPath('temp'), 'hive-server-install')
        writeFileSync(tmpPath, scriptContent, { mode: 0o755 })
        try {
          await execAsync(
            `pkexec sh -c "mv '${tmpPath}' '${installPlan.targetPath}' && chmod +x '${installPlan.targetPath}'"`,
            { timeout: 30000 }
          )
        } catch {
          const fallbackPath = getUserHiveServerPath(app.getPath('home'))
          mkdirSync(dirname(fallbackPath), { recursive: true })
          writeFileSync(fallbackPath, scriptContent, { mode: 0o755 })
          return {
            success: true,
            path: fallbackPath,
            warning: `Could not install to ${installPlan.targetPath}; installed to ${fallbackPath} instead. Add ${dirname(fallbackPath)} to PATH to use hive-server globally.`
          }
        }
      } else {
        mkdirSync(dirname(installPlan.targetPath), { recursive: true })
        writeFileSync(installPlan.targetPath, scriptContent, { mode: 0o755 })
      }

      if (installPlan.targetPath === getUserHiveServerPath(app.getPath('home'))) {
        const userBinDir = dirname(installPlan.targetPath)
        const pathEntries = (process.env.PATH || '').split(':')
        if (!pathEntries.includes(userBinDir)) {
          return {
            success: true,
            path: installPlan.targetPath,
            warning: `Add ${userBinDir} to PATH to use hive-server globally.`
          }
        }
      }

      return { success: true, path: installPlan.targetPath }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('User canceled') || message.includes('Not authorized')) {
        return { success: false, error: 'Installation cancelled' }
      }
      return { success: false, error: message }
    }
  })

  // Uninstall hive-server from PATH
  ipcMain.handle('system:uninstallServerFromPath', async () => {
    const execAsync = promisify(exec)

    if (process.platform === 'win32') {
      try {
        const installDir = join(process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local'), 'Hive')
        const targetPath = join(installDir, 'hive-server.cmd')
        if (!existsSync(targetPath)) {
          return { success: false, error: 'hive-server is not installed' }
        }

        unlinkSync(targetPath)

        // Remove from user PATH via PowerShell (escape single quotes for safe interpolation)
        const escapedDir = installDir.replace(/'/g, "''")
        const psCmd = `$d='${escapedDir}'; $p = [Environment]::GetEnvironmentVariable('Path','User'); [Environment]::SetEnvironmentVariable('Path', ($p -split ';' | Where-Object { $_ -ne $d }) -join ';','User')`
        await execAsync(`powershell -Command "${psCmd}"`, { timeout: 15000 })

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }

    if (process.platform === 'darwin') {
      const targetPath = SYSTEM_HIVE_SERVER_PATH
      try {
        if (!existsSync(targetPath)) {
          return { success: false, error: 'hive-server is not installed' }
        }

        const osascript = `do shell script "rm '${targetPath}'" with administrator privileges`
        await execAsync(`osascript -e '${osascript}'`, { timeout: 30000 })
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (
          message.includes('User canceled') ||
          message.includes('-128') ||
          message.includes('Not authorized')
        ) {
          return { success: false, error: 'Uninstall cancelled' }
        }
        return { success: false, error: message }
      }
    }

    // Linux
    try {
      const installedPaths = getLinuxUninstallCandidates(app.getPath('home')).filter((candidate) =>
        existsSync(candidate)
      )
      const errors: string[] = []
      if (installedPaths.length === 0) {
        return { success: false, error: 'hive-server is not installed' }
      }

      for (const installedPath of installedPaths) {
        if (installedPath === SYSTEM_HIVE_SERVER_PATH && !canWriteParentDir(installedPath)) {
          if (!hasCommand('pkexec')) {
            errors.push(`Cannot remove ${installedPath} automatically because pkexec is unavailable`)
            continue
          }
          try {
            await execAsync(`pkexec rm '${installedPath}'`, { timeout: 30000 })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!message.includes('No such file or directory')) {
              errors.push(message)
            }
          }
        } else {
          try {
            unlinkSync(installedPath)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            errors.push(message)
          }
        }
      }

      if (errors.length > 0) {
        return { success: false, error: errors.join('; ') }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('User canceled') || message.includes('Not authorized')) {
        return { success: false, error: 'Uninstall cancelled' }
      }
      return { success: false, error: message }
    }
  })
}

// Register response logging IPC handlers (only when --log is active)
function registerLoggingHandlers(): void {
  ipcMain.handle('logging:createResponseLog', (_, sessionId: string) => {
    return createResponseLog(sessionId)
  })

  ipcMain.handle('logging:appendResponseLog', (_, filePath: string, data: unknown) => {
    appendResponseLog(filePath, data)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Load full shell environment for macOS when launched from Finder/Dock/Spotlight.
  // Must run before any child process spawning (opencode, scripts, Claude Code SDK).
  loadShellEnv()

  // Resolve system-wide Claude binary (must run after loadShellEnv)
  const claudeBinaryPath = resolveClaudeBinaryPath()

  log.info('App starting', {
    version: app.getVersion(),
    platform: process.platform,
    claudeBinary: claudeBinaryPath ?? 'not found'
  })

  if (isLogMode) {
    log.info('Response logging enabled via --log flag')
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.hive')

  // --- Headless mode ---
  if (isHeadless) {
    log.info('Starting in headless mode')

    // Handle one-shot management commands
    if (isRotateKey || isRegenCerts || isShowStatus || isKill || isUnlock) {
      const { handleManagementCommand } = await import('../server/headless-bootstrap')
      await handleManagementCommand({
        rotateKey: isRotateKey,
        regenCerts: isRegenCerts,
        showStatus: isShowStatus,
        kill: isKill,
        unlock: isUnlock
      })
      app.quit()
      return
    }

    // Normal headless startup
    const { headlessBootstrap } = await import('../server/headless-bootstrap')
    await headlessBootstrap({ port: headlessPort, bind: headlessBind })
    return
  }
  // --- End headless mode ---

  // Initialize database
  log.info('Initializing database')
  getDatabase()

  // Initialize telemetry (must come after DB init since it reads/writes settings)
  telemetryService.init()

  // Register IPC handlers
  log.info('Registering IPC handlers')
  registerDatabaseHandlers()
  registerProjectHandlers()
  registerWorktreeHandlers()
  registerSystemHandlers()
  registerSettingsHandlers()
  registerFileHandlers()
  registerConnectionHandlers()
  registerUsageHandlers()
  registerKanbanHandlers()
  initTicketProviderManager([new GitHubProvider(), new JiraProvider()])
  registerTicketImportHandlers()

  // Telemetry IPC
  ipcMain.handle(
    'telemetry:track',
    (_event, eventName: string, properties?: Record<string, unknown>) => {
      telemetryService.track(eventName, properties)
    }
  )

  ipcMain.handle('telemetry:setEnabled', (_event, enabled: boolean) => {
    return telemetryService.setEnabled(enabled)
  })

  ipcMain.handle('telemetry:isEnabled', () => {
    return telemetryService.isEnabled()
  })

  // Register response logging handlers only when --log is active
  if (isLogMode) {
    log.info('Registering response logging handlers')
    registerLoggingHandlers()
  }

  createWindow()

  // Register OpenCode handlers after window is created
  if (mainWindow) {
    // Build the full application menu (File, Edit, Session, Git, View, Window, Help)
    log.info('Building application menu')
    buildMenu(mainWindow, is.dev)

    // Register menu state update handler (renderer tells main which items to enable/disable)
    ipcMain.handle('menu:updateState', (_event, state: MenuState) => {
      updateMenuState(state)
    })

    // Create SDK manager for multi-provider dispatch
    // OpenCode sessions still route through openCodeService directly (fallback path in handlers)
    // The placeholder just satisfies AgentSdkManager's constructor signature
    const claudeImpl = new ClaudeCodeImplementer()
    claudeImpl.setDatabaseService(getDatabase())
    claudeImpl.setClaudeBinaryPath(claudeBinaryPath)
    const openCodePlaceholder = {
      id: 'opencode' as const,
      capabilities: {
        supportsUndo: true,
        supportsRedo: true,
        supportsCommands: true,
        supportsPermissionRequests: true,
        supportsQuestionPrompts: true,
        supportsModelSelection: true,
        supportsReconnect: true,
        supportsPartialStreaming: true
      },
      connect: async () => ({ sessionId: '' }),
      reconnect: async () => ({ success: false }),
      disconnect: async () => {},
      cleanup: async () => {},
      prompt: async () => {},
      abort: async () => false,
      getMessages: async () => [],
      getAvailableModels: async () => ({}),
      getModelInfo: async () => null,
      setSelectedModel: () => {},
      getSessionInfo: async () => ({ revertMessageID: null, revertDiff: null }),
      questionReply: async () => {},
      questionReject: async () => {},
      permissionReply: async () => {},
      permissionList: async () => [],
      undo: async () => ({}),
      redo: async () => ({}),
      listCommands: async () => [],
      sendCommand: async () => {},
      renameSession: async () => {},
      setMainWindow: () => {}
    } satisfies AgentSdkImplementer
    const codexImpl = new CodexImplementer()
    codexImpl.setDatabaseService(getDatabase())
    const omxImpl = new OmxImplementer()
    omxImpl.setDatabaseService(getDatabase())
    const sdkManager = new AgentSdkManager([openCodePlaceholder, claudeImpl, codexImpl, omxImpl])
    sdkManager.setMainWindow(mainWindow)

    const databaseService = getDatabase()

    log.info('Registering OpenCode handlers')
    registerOpenCodeHandlers(mainWindow, sdkManager, databaseService)
    log.info('Registering FileTree handlers')
    registerFileTreeHandlers(mainWindow)
    log.info('Registering GitFile handlers')
    registerGitFileHandlers(mainWindow)
    log.info('Registering Script handlers')
    registerScriptHandlers(mainWindow)
    log.info('Registering Terminal handlers')
    registerTerminalHandlers(mainWindow)
    log.info('Registering OMX handlers')
    registerOmxHandlers()

    // Set up notification service with main window reference
    notificationService.setMainWindow(mainWindow)

    // Register updater IPC handlers and initialize auto-updater
    registerUpdaterHandlers()
    updaterService.init(mainWindow)

    // Track app launch telemetry
    telemetryService.track('app_launched')
    telemetryService.identify({
      platform: process.platform,
      app_version: app.getVersion(),
      electron_version: process.versions.electron
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup when app is about to quit
app.on('will-quit', async () => {
  // Cleanup updater timers
  updaterService.cleanup()
  // Cleanup tmux-backed OMX sessions before database shutdown
  await cleanupActiveOmxTmuxSessions()
  // Cleanup terminal PTYs
  await cleanupTerminals()
  // Cleanup running scripts
  cleanupScripts()
  // Cleanup file tree watchers
  await cleanupFileTreeWatchers()
  // Cleanup worktree watchers (git status monitoring)
  await cleanupWorktreeWatchers()
  // Cleanup branch watchers (sidebar branch names)
  await cleanupBranchWatchers()
  // Cleanup OpenCode connections
  await cleanupOpenCode()
  // Flush telemetry before closing database
  telemetryService.track('app_session_ended', {
    session_duration_ms: Date.now() - appStartTime
  })
  await telemetryService.shutdown()
  // Close database
  closeDatabase()
})
