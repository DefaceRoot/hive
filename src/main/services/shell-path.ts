import { existsSync } from 'fs'

export function resolveDefaultShell(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.SHELL) return env.SHELL
  if (platform === 'win32') return 'powershell.exe'
  if (platform === 'darwin') return '/bin/zsh'
  return existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh'
}
