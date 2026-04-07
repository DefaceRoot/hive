import { afterEach, describe, expect, test, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const repoRoot = resolve(__dirname, '../..')
const originalHome = process.env.HOME
const originalXdgDataHome = process.env.XDG_DATA_HOME

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.HOME
  } else {
    process.env.HOME = originalHome
  }

  if (originalXdgDataHome === undefined) {
    delete process.env.XDG_DATA_HOME
  } else {
    process.env.XDG_DATA_HOME = originalXdgDataHome
  }

  vi.resetModules()
})

describe('linux dev launcher install script', () => {
  test('writes a desktop entry that launches the repo-local script instead of an AppImage', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'hive-launcher-home-'))
    const xdgDataHome = join(homeDir, '.local', 'share')

    process.env.HOME = homeDir
    process.env.XDG_DATA_HOME = xdgDataHome

    const { installDesktopEntry } = await import('../../scripts/install-linux-dev-launcher.js')

    installDesktopEntry()

    const desktopFilePath = join(xdgDataHome, 'applications', 'Hive.desktop')
    const desktopFile = readFileSync(desktopFilePath, 'utf8')

    expect(desktopFile).toContain(`Exec=${join(repoRoot, 'scripts', 'launch-local.sh')}`)
    expect(desktopFile).toContain(`TryExec=${join(repoRoot, 'scripts', 'launch-local.sh')}`)
    expect(desktopFile).toContain(`Icon=${join(repoRoot, 'resources', 'icon.png')}`)
    expect(desktopFile).toContain(`X-Hive-Repo=${repoRoot}`)
    expect(desktopFile).not.toContain('Hive.AppImage')

    rmSync(homeDir, { recursive: true, force: true })
  })
})
