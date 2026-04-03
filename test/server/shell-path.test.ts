import { afterEach, describe, expect, test, vi } from 'vitest'

const existsSyncMock = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args)
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('resolveDefaultShell', () => {
  test('prefers SHELL when provided', async () => {
    const { resolveDefaultShell } = await import('../../src/main/services/shell-path')

    expect(resolveDefaultShell('linux', { SHELL: '/usr/bin/fish' })).toBe('/usr/bin/fish')
  })

  test('falls back to /bin/sh on Linux when /bin/bash is unavailable', async () => {
    existsSyncMock.mockReturnValue(false)
    const { resolveDefaultShell } = await import('../../src/main/services/shell-path')

    expect(resolveDefaultShell('linux', {})).toBe('/bin/sh')
    expect(existsSyncMock).toHaveBeenCalledWith('/bin/bash')
  })

  test('uses /bin/zsh by default on macOS', async () => {
    const { resolveDefaultShell } = await import('../../src/main/services/shell-path')

    expect(resolveDefaultShell('darwin', {})).toBe('/bin/zsh')
  })
})
