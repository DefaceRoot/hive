import { describe, expect, test } from 'vitest'
import {
  buildHiveServerScript,
  chooseLinuxInstallTarget,
  getLinuxUninstallCandidates,
  getUserHiveServerPath,
  SYSTEM_HIVE_SERVER_PATH
} from '../../src/main/services/hive-server-path'

describe('hive-server-path helpers', () => {
  test('buildHiveServerScript uses POSIX shell and headless flag', () => {
    expect(buildHiveServerScript('/opt/Hive/hive')).toContain('#!/bin/sh')
    expect(buildHiveServerScript('/opt/Hive/hive')).toContain('exec "/opt/Hive/hive" --headless "$@"')
  })

  test('prefers system path when writable', () => {
    expect(
      chooseLinuxInstallTarget({
        canWriteSystemPath: true,
        hasPkexec: false,
        homeDir: '/home/tester'
      })
    ).toEqual({
      targetPath: SYSTEM_HIVE_SERVER_PATH,
      requiresPrivilege: false
    })
  })

  test('prefers privileged system install when pkexec is available', () => {
    expect(
      chooseLinuxInstallTarget({
        canWriteSystemPath: false,
        hasPkexec: true,
        homeDir: '/home/tester'
      })
    ).toEqual({
      targetPath: SYSTEM_HIVE_SERVER_PATH,
      requiresPrivilege: true
    })
  })

  test('falls back to ~/.local/bin when system install is unavailable', () => {
    expect(
      chooseLinuxInstallTarget({
        canWriteSystemPath: false,
        hasPkexec: false,
        homeDir: '/home/tester'
      })
    ).toEqual({
      targetPath: '/home/tester/.local/bin/hive-server',
      requiresPrivilege: false
    })
  })

  test('returns both uninstall candidates in priority order', () => {
    expect(getUserHiveServerPath('/home/tester')).toBe('/home/tester/.local/bin/hive-server')
    expect(getLinuxUninstallCandidates('/home/tester')).toEqual([
      '/usr/local/bin/hive-server',
      '/home/tester/.local/bin/hive-server'
    ])
  })
})
