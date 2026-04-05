export interface OmxStartupCommandOptions {
  cwd: string
  tmuxSessionName: string
  launchArgs?: string[]
}

export const DEFAULT_OMX_LAUNCH_ARGS = ['--madmax', '--high']

export function quoteOmxShellArg(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

export function buildOmxTmuxSessionName(hiveSessionId: string): string {
  const normalized = hiveSessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'session'
  return `hive-omx-${normalized}`
}

export function buildOmxStartupCommand(options: OmxStartupCommandOptions): string {
  const launchArgs = options.launchArgs?.length ? options.launchArgs : DEFAULT_OMX_LAUNCH_ARGS
  const tmuxSession = quoteOmxShellArg(options.tmuxSessionName)
  const launchCommand = ['omx', ...launchArgs].map(quoteOmxShellArg).join(' ')

  return [
    `tmux has-session -t ${tmuxSession} 2>/dev/null || tmux new-session -d -s ${tmuxSession} -c ${quoteOmxShellArg(options.cwd)} ${launchCommand}`,
    "tmux set-option -s extended-keys on >/dev/null 2>&1 || true",
    "tmux set-option -s extended-keys-format csi-u >/dev/null 2>&1 || true",
    `tmux set-option -t ${tmuxSession} -g mouse on >/dev/null 2>&1 || true`,
    `tmux attach-session -t ${tmuxSession}`
  ].join('; ')
}
