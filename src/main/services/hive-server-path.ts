import { join } from 'path'

export const SYSTEM_HIVE_SERVER_PATH = '/usr/local/bin/hive-server'

export function getUserHiveServerPath(homeDir: string): string {
  return join(homeDir, '.local', 'bin', 'hive-server')
}

export function buildHiveServerScript(execPath: string): string {
  return [
    '#!/bin/sh',
    '# hive-server — Hive headless mode launcher',
    '# Installed by Hive',
    `exec "${execPath}" --headless "$@"`
  ].join('\n') + '\n'
}

export function chooseLinuxInstallTarget(options: {
  canWriteSystemPath: boolean
  hasPkexec: boolean
  homeDir: string
}): { targetPath: string; requiresPrivilege: boolean } {
  if (options.canWriteSystemPath || options.hasPkexec) {
    return {
      targetPath: SYSTEM_HIVE_SERVER_PATH,
      requiresPrivilege: !options.canWriteSystemPath
    }
  }

  return {
    targetPath: getUserHiveServerPath(options.homeDir),
    requiresPrivilege: false
  }
}

export function getLinuxUninstallCandidates(homeDir: string): string[] {
  return [SYSTEM_HIVE_SERVER_PATH, getUserHiveServerPath(homeDir)]
}
