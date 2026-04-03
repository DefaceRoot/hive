import { execFile } from 'node:child_process'

export interface OmxModeStatus {
  mode: string
  active: boolean
  phase: string
}

export interface OmxStartupCommandOptions {
  cwd: string
  tmuxSessionName: string
  launchArgs?: string[]
}

const DEFAULT_OMX_LAUNCH_ARGS = ['--madmax', '--high']
const STATUS_LINE_RE = /^([^:]+):\s+(ACTIVE|inactive)\s+\(phase:\s+([^)]+)\)\s*$/i

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
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

export function parseOmxStatusOutput(output: string): OmxModeStatus[] {
  const trimmed = output.trim()
  if (!trimmed || trimmed === 'No active modes.') {
    return []
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(STATUS_LINE_RE)
      if (!match) return null

      return {
        mode: match[1].trim(),
        active: match[2].toLowerCase() === 'active',
        phase: match[3].trim()
      } satisfies OmxModeStatus
    })
    .filter((value): value is OmxModeStatus => value !== null)
}

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

export async function getOmxStatus(cwd: string): Promise<OmxModeStatus[]> {
  const stdout = await execFileText('omx', ['status'], cwd)
  return parseOmxStatusOutput(stdout)
}

export async function killOmxTmuxSession(tmuxSessionName: string): Promise<void> {
  await execFileText('tmux', ['kill-session', '-t', tmuxSessionName])
}
