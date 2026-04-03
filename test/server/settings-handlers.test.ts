import { beforeEach, describe, expect, test, vi } from 'vitest'

const existsSyncMock = vi.fn()
const platformMock = vi.fn(() => 'linux')
const detectTerminalsMock = vi.fn()
const detectEditorsMock = vi.fn()
const getSettingMock = vi.fn()
const spawnDetachedMock = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args)
}))

vi.mock('os', () => ({
  platform: () => platformMock()
}))

vi.mock('../../src/main/services/settings-detection', () => ({
  detectTerminals: () => detectTerminalsMock(),
  detectEditors: () => detectEditorsMock()
}))

vi.mock('../../src/main/db', () => ({
  getDatabase: () => ({
    getSetting: (...args: unknown[]) => getSettingMock(...args)
  })
}))

vi.mock('../../src/main/services/spawn-detached', () => ({
  spawnDetached: (...args: unknown[]) => spawnDetachedMock(...args)
}))

vi.mock('../../src/main/services', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../src/main/services/telemetry-service', () => ({
  telemetryService: {
    track: vi.fn()
  }
}))

describe('settings handlers Linux paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existsSyncMock.mockReturnValue(true)
    platformMock.mockReturnValue('linux')
  })

  test('opens preferred Linux terminal using detected command', async () => {
    getSettingMock.mockReturnValue(
      JSON.stringify({
        defaultTerminal: 'gnome-terminal'
      })
    )
    detectTerminalsMock.mockReturnValue([
      { id: 'gnome-terminal', available: true, command: '/usr/bin/gnome-terminal' }
    ])
    spawnDetachedMock.mockResolvedValue(undefined)

    const { openPathWithPreferredTerminal } = await import('../../src/main/ipc/settings-handlers')
    const result = await openPathWithPreferredTerminal('/tmp/project')

    expect(result).toEqual({ success: true })
    expect(spawnDetachedMock).toHaveBeenCalledWith('/usr/bin/gnome-terminal', [], {
      cwd: '/tmp/project'
    })
  })

  test('returns a clear error when the preferred Linux terminal is unavailable', async () => {
    getSettingMock.mockReturnValue(
      JSON.stringify({
        defaultTerminal: 'ghostty'
      })
    )
    detectTerminalsMock.mockReturnValue([{ id: 'ghostty', available: false, command: 'ghostty' }])

    const { openPathWithPreferredTerminal } = await import('../../src/main/ipc/settings-handlers')
    const result = await openPathWithPreferredTerminal('/tmp/project')

    expect(result).toEqual({ success: false, error: 'Terminal not found' })
  })

  test('falls back to the first available Linux terminal when default terminal shim is missing', async () => {
    getSettingMock.mockReturnValue(
      JSON.stringify({
        defaultTerminal: 'terminal'
      })
    )
    detectTerminalsMock.mockReturnValue([
      { id: 'terminal', available: false, command: 'x-terminal-emulator' },
      { id: 'kitty', available: true, command: '/usr/bin/kitty' }
    ])
    spawnDetachedMock.mockResolvedValue(undefined)

    const { openPathWithPreferredTerminal } = await import('../../src/main/ipc/settings-handlers')
    const result = await openPathWithPreferredTerminal('/tmp/project')

    expect(result).toEqual({ success: true })
    expect(spawnDetachedMock).toHaveBeenCalledWith('/usr/bin/kitty', [], {
      cwd: '/tmp/project'
    })
  })

  test('remains successful when a Linux fallback terminal exists even if x-terminal-emulator is absent', async () => {
    getSettingMock.mockReturnValue(JSON.stringify({ defaultTerminal: 'terminal' }))
    detectTerminalsMock.mockReturnValue([
      { id: 'terminal', available: false, command: 'x-terminal-emulator' },
      { id: 'gnome-terminal', available: true, command: '/usr/bin/gnome-terminal' }
    ])
    spawnDetachedMock.mockResolvedValue(undefined)

    const { openPathWithPreferredTerminal } = await import('../../src/main/ipc/settings-handlers')
    const result = await openPathWithPreferredTerminal('/tmp/project')

    expect(result).toEqual({ success: true })
  })

  test('returns spawn errors for preferred editors instead of silently succeeding', async () => {
    getSettingMock.mockReturnValue(
      JSON.stringify({
        defaultEditor: 'cursor'
      })
    )
    detectEditorsMock.mockReturnValue([
      { id: 'cursor', available: true, command: '/usr/bin/cursor' }
    ])
    spawnDetachedMock.mockRejectedValue(new Error('spawn ENOENT'))

    const { openPathWithPreferredEditor } = await import('../../src/main/ipc/settings-handlers')
    const result = await openPathWithPreferredEditor('/tmp/project')

    expect(result).toEqual({ success: false, error: 'spawn ENOENT' })
  })
})
