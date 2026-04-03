import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { platform } from 'os'
import { createLogger } from '../services'
import { telemetryService } from '../services/telemetry-service'
import { getDatabase } from '../db'
import { detectEditors, detectTerminals, type DetectedApp } from '../services/settings-detection'
import { APP_SETTINGS_DB_KEY } from '@shared/types/settings'
import { spawnDetached } from '../services/spawn-detached'

const log = createLogger({ component: 'SettingsHandlers' })

function resolveEditorCommand(
  editorId: string,
  customCommand?: string
): { command: string } | { error: string } {
  if (editorId === 'custom' && customCommand) {
    return { command: customCommand }
  }
  const editors = detectEditors()
  const editor = editors.find((e) => e.id === editorId)
  if (!editor?.available) {
    return { error: `Editor ${editorId} not found` }
  }
  return { command: editor.command }
}

/**
 * Launch a terminal at the given path using the specified terminal ID.
 * Contains all platform-specific terminal launch logic in one place.
 */
async function launchTerminal(
  targetPath: string,
  terminalId: string,
  customCommand?: string
): Promise<{ success: boolean; error?: string }> {
  const currentPlatform = platform()

  if (terminalId === 'custom' && customCommand) {
    try {
      await spawnDetached(customCommand, [targetPath], { cwd: targetPath })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Terminal not found' }
    }
  }

  try {
    if (currentPlatform === 'darwin') {
      switch (terminalId) {
        case 'terminal':
          await spawnDetached('open', ['-a', 'Terminal', targetPath])
          break
        case 'iterm':
          await spawnDetached('open', ['-a', 'iTerm', targetPath])
          break
        case 'warp':
          await spawnDetached('open', ['-a', 'Warp', targetPath])
          break
        case 'alacritty':
          await spawnDetached('alacritty', ['--working-directory', targetPath])
          break
        case 'kitty':
          await spawnDetached('kitty', ['--directory', targetPath])
          break
        case 'ghostty':
          await spawnDetached('open', ['-a', 'Ghostty', targetPath])
          break
        default:
          await spawnDetached('open', ['-a', 'Terminal', targetPath])
      }
    } else if (currentPlatform === 'win32') {
      switch (terminalId) {
        case 'terminal': {
          // Windows Terminal may not be installed; fall back to PowerShell
          const terminals = detectTerminals()
          const wt = terminals.find((t) => t.id === 'terminal')
          if (wt?.available) {
            await spawnDetached('wt.exe', ['-d', targetPath])
          } else {
            await spawnDetached('powershell.exe', [
              '-NoExit',
              '-Command',
              `Set-Location '${targetPath.replace(/'/g, "''")}'`
            ])
          }
          break
        }
        case 'powershell':
          await spawnDetached('powershell.exe', [
            '-NoExit',
            '-Command',
            `Set-Location '${targetPath.replace(/'/g, "''")}'`
          ])
          break
        case 'cmd':
          await spawnDetached('cmd.exe', ['/k', `cd /d "${targetPath}"`])
          break
        default: {
          const terminals = detectTerminals()
          const terminal = terminals.find((t) => t.id === terminalId)
          if (!terminal?.available) {
            return { success: false, error: 'Terminal not found' }
          }
          await spawnDetached(terminal.command, [], { cwd: targetPath })
        }
      }
    } else {
      const terminals = detectTerminals()
      const terminal =
        terminals.find((t) => t.id === terminalId && t.available) ??
        (terminalId === 'terminal' ? terminals.find((t) => t.available) : undefined)
      if (!terminal?.available) {
        return { success: false, error: 'Terminal not found' }
      }
      await spawnDetached(terminal.command, [], { cwd: targetPath })
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to launch terminal' }
  }
}

/**
 * Open a path with the user's preferred editor (reads defaultEditor and customEditorCommand from DB).
 * Used by worktree, connection, and git "Open in Editor" handlers.
 */
export function openPathWithPreferredEditor(
  path: string
): Promise<{ success: boolean; error?: string }> {
  if (!existsSync(path)) {
    return Promise.resolve({ success: false, error: 'Path does not exist' })
  }
  let editorId = 'vscode'
  let customCommand = ''
  try {
    const raw = getDatabase().getSetting(APP_SETTINGS_DB_KEY)
    if (raw) {
      const settings = JSON.parse(raw) as { defaultEditor?: string; customEditorCommand?: string }
      if (settings.defaultEditor) editorId = settings.defaultEditor
      if (settings.customEditorCommand != null) customCommand = settings.customEditorCommand
    }
  } catch {
    // Use defaults
  }
  const resolved = resolveEditorCommand(editorId, customCommand || undefined)
  if ('error' in resolved) {
    return Promise.resolve({ success: false, error: resolved.error })
  }
  return spawnDetached(resolved.command, [path])
    .then(() => ({ success: true }))
    .catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }))
}

/**
 * Open a path with the user's preferred terminal (reads defaultTerminal and customTerminalCommand from DB).
 * Used by worktree, connection, and keyboard shortcut "Open in Terminal" handlers.
 */
export function openPathWithPreferredTerminal(
  path: string
): Promise<{ success: boolean; error?: string }> {
  if (!existsSync(path)) {
    return Promise.resolve({ success: false, error: 'Path does not exist' })
  }
  let terminalId = 'terminal'
  let customCommand = ''
  try {
    const raw = getDatabase().getSetting(APP_SETTINGS_DB_KEY)
    if (raw) {
      const settings = JSON.parse(raw) as { defaultTerminal?: string; customTerminalCommand?: string }
      if (settings.defaultTerminal) terminalId = settings.defaultTerminal
      if (settings.customTerminalCommand != null) customCommand = settings.customTerminalCommand
    }
  } catch {
    // Use defaults
  }
  try {
    return launchTerminal(path, terminalId, customCommand || undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Promise.resolve({ success: false, error: message })
  }
}

export function registerSettingsHandlers(): void {
  log.info('Registering settings handlers')

  // Detect installed editors
  ipcMain.handle('settings:detectEditors', async (): Promise<DetectedApp[]> => {
    try {
      return detectEditors()
    } catch (error) {
      log.error(
        'Failed to detect editors',
        error instanceof Error ? error : new Error(String(error))
      )
      return []
    }
  })

  // Detect installed terminals
  ipcMain.handle('settings:detectTerminals', async (): Promise<DetectedApp[]> => {
    try {
      return detectTerminals()
    } catch (error) {
      log.error(
        'Failed to detect terminals',
        error instanceof Error ? error : new Error(String(error))
      )
      return []
    }
  })

  // Open a path with a specific editor command (explicit editorId/customCommand from renderer)
  ipcMain.handle(
    'settings:openWithEditor',
    async (
      _event,
      worktreePath: string,
      editorId: string,
      customCommand?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!existsSync(worktreePath)) {
          return { success: false, error: 'Path does not exist' }
        }
        const resolved = resolveEditorCommand(editorId, customCommand)
        if ('error' in resolved) {
          return { success: false, error: resolved.error }
        }

        await spawnDetached(resolved.command, [worktreePath])
        telemetryService.track('worktree_opened_in_editor')
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
      }
    }
  )

  // Open a path with a specific terminal (explicit terminalId/customCommand from renderer)
  ipcMain.handle(
    'settings:openWithTerminal',
    async (
      _event,
      worktreePath: string,
      terminalId: string,
      customCommand?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!existsSync(worktreePath)) {
          return { success: false, error: 'Path does not exist' }
        }
        return await launchTerminal(worktreePath, terminalId, customCommand)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
      }
    }
  )

  // Get all settings as a batch
  ipcMain.handle('settings:getAll', async (): Promise<Record<string, string>> => {
    try {
      const db = getDatabase()
      const allSettings = db.getAllSettings()
      const result: Record<string, string> = {}
      for (const setting of allSettings) {
        result[setting.key] = setting.value
      }
      return result
    } catch (error) {
      log.error(
        'Failed to get all settings',
        error instanceof Error ? error : new Error(String(error))
      )
      return {}
    }
  })
}
