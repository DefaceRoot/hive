import { beforeEach, describe, expect, test, vi } from 'vitest'

const autoUpdaterMock = vi.hoisted(() => ({
  autoDownload: false,
  autoInstallOnAppQuit: true,
  logger: null as unknown,
  channel: 'latest',
  allowPrerelease: false,
  allowDowngrade: false,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn()
}))

const appMock = vi.hoisted(() => ({
  isPackaged: true,
  getVersion: vi.fn(() => '1.0.85')
}))

vi.mock('electron-updater', () => ({
  autoUpdater: autoUpdaterMock
}))

vi.mock('electron', () => ({
  app: appMock
}))

vi.mock('../../src/main/services/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../src/main/db', () => ({
  getDatabase: () => ({
    getSetting: () => null
  })
}))

describe('updaterService on Linux', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    appMock.isPackaged = true
  })

  test('skips updater initialization on Linux', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })

    const { updaterService } = await import('../../src/main/services/updater')
    const mockWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } }

    updaterService.init(mockWindow as never)

    expect(autoUpdaterMock.on).not.toHaveBeenCalled()
    expect(updaterService.isSupported()).toBe(false)

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  test('no-ops updater actions on Linux', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })

    const { updaterService } = await import('../../src/main/services/updater')

    await updaterService.checkForUpdates({ manual: true })
    await updaterService.downloadUpdate()
    updaterService.quitAndInstall()
    updaterService.setChannel('canary')

    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled()
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })
})
