import { execFile } from 'node:child_process'

export interface OmxStartupCommandOptions {
  cwd: string
  tmuxSessionName: string
  launchArgs?: string[]
}

const DEFAULT_OMX_LAUNCH_ARGS = ['--madmax', '--high']

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

export function buildOmxTmuxSessionName(hiveSessionId: string): string {
  const normalized = hiveSessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'session'
  return `hive-omx-${normalized}`
}

export function buildOmxStartupCommand(options: OmxStartupCommandOptions): string {
  const launchArgs = options.launchArgs?.length ? options.launchArgs : DEFAULT_OMX_LAUNCH_ARGS
  const tmuxSession = quoteShellArg(options.tmuxSessionName)
  const launchCommand = ['omx', ...launchArgs].map(quoteShellArg).join(' ')

  return [
    `tmux has-session -t ${tmuxSession} 2>/dev/null || tmux new-session -d -s ${tmuxSession} -c ${quoteShellArg(options.cwd)} ${launchCommand}`,
    "tmux set-option -s extended-keys on >/dev/null 2>&1 || true",
    "tmux set-option -s extended-keys-format csi-u >/dev/null 2>&1 || true",
    `tmux set-option -t ${tmuxSession} -g mouse on >/dev/null 2>&1 || true`,
    `tmux attach-session -t ${tmuxSession}`
  ].join('; ')
}

export const buildOmxBootstrapCommand = buildOmxStartupCommand

function execFileText(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: 'utf-8' }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}

export async function killOmxTmuxSession(tmuxSessionName: string): Promise<void> {
  await execFileText('tmux', ['kill-session', '-t', tmuxSessionName])
}
