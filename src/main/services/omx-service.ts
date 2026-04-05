import { execFile } from 'node:child_process'
import {
  DEFAULT_OMX_LAUNCH_ARGS,
  buildOmxStartupCommand,
  buildOmxTmuxSessionName,
  type OmxStartupCommandOptions
} from '@shared/omx'
import type { DatabaseService } from '../db/database'

type OmxPromptInput =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'file'; mime: string; url: string; filename?: string }
    >

export const buildOmxBootstrapCommand = buildOmxStartupCommand

function execFileText(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: 'utf-8' }, (error, stdout, stderr) => {
      if (error) {
        if (stderr) {
          error.message = `${error.message}\n${stderr}`.trim()
        }
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}

async function hasOmxTmuxSession(tmuxSessionName: string): Promise<boolean> {
  try {
    await execFileText('tmux', ['has-session', '-t', tmuxSessionName])
    return true
  } catch {
    return false
  }
}

async function execTmux(args: string[]): Promise<void> {
  await execFileText('tmux', args)
}

async function configureOmxTmuxSession(tmuxSessionName: string): Promise<void> {
  await execTmux(['set-option', '-s', 'extended-keys', 'on'])
  await execTmux(['set-option', '-s', 'extended-keys-format', 'csi-u'])
  await execTmux(['set-option', '-t', tmuxSessionName, '-g', 'mouse', 'on'])
}

export async function ensureOmxTmuxSession(
  cwd: string,
  tmuxSessionName: string,
  launchArgs?: string[]
): Promise<void> {
  if (!(await hasOmxTmuxSession(tmuxSessionName))) {
    const args = launchArgs?.length ? launchArgs : DEFAULT_OMX_LAUNCH_ARGS
    await execTmux(['new-session', '-d', '-s', tmuxSessionName, '-c', cwd, 'omx', ...args])
  }

  await configureOmxTmuxSession(tmuxSessionName)
}

export async function killOmxTmuxSession(tmuxSessionName: string): Promise<boolean> {
  if (!(await hasOmxTmuxSession(tmuxSessionName))) {
    return false
  }
  await execTmux(['kill-session', '-t', tmuxSessionName])
  return true
}

export async function cleanupOmxTmuxSessions(
  tmuxSessionNames: Array<string | null | undefined>
): Promise<void> {
  const uniqueNames = [
    ...new Set(tmuxSessionNames.filter((name): name is string => !!name?.trim()))
  ]
  for (const tmuxSessionName of uniqueNames) {
    try {
      await killOmxTmuxSession(tmuxSessionName)
    } catch {
      // Best-effort cleanup — sessions may already be gone or tmux may be unavailable
    }
  }
}

function flattenOmxPromptInput(input: OmxPromptInput): string {
  if (typeof input === 'string') {
    return input
  }

  return input
    .map((part) => {
      if (part.type === 'text') {
        return part.text
      }

      return `[Attachment] ${part.filename || part.url}`
    })
    .filter((value) => value.trim().length > 0)
    .join('\n\n')
}

export async function sendTextToOmxTmuxSession(
  tmuxSessionName: string,
  input: OmxPromptInput
): Promise<void> {
  const text = flattenOmxPromptInput(input).replace(/\r\n/g, '\n')
  const lines = text.split('\n')

  for (const line of lines) {
    if (line.length > 0) {
      await execTmux(['send-keys', '-t', tmuxSessionName, '-l', '--', line])
    }
    await execTmux(['send-keys', '-t', tmuxSessionName, 'Enter'])
  }
}

export async function interruptOmxTmuxSession(tmuxSessionName: string): Promise<void> {
  await execTmux(['send-keys', '-t', tmuxSessionName, 'C-c'])
}

export async function cleanupActiveOmxSessions(
  db: Pick<DatabaseService, 'getActiveSessionsByAgentSdk'>
): Promise<void> {
  await cleanupOmxTmuxSessions(
    db.getActiveSessionsByAgentSdk('omx').map((session) => session.opencode_session_id)
  )
}

export { buildOmxStartupCommand, buildOmxTmuxSessionName, type OmxStartupCommandOptions }
