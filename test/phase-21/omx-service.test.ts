import { describe, expect, it } from 'vitest'
import {
  buildOmxStartupCommand,
  buildOmxTmuxSessionName,
  parseOmxStatusOutput
} from '../../src/main/services/omx-service'

describe('omx-service', () => {
  it('builds a stable tmux session name from the Hive session id', () => {
    expect(buildOmxTmuxSessionName('session-123')).toBe('hive-omx-session-123')
    expect(buildOmxTmuxSessionName('weird/session:id')).toBe('hive-omx-weirdsessionid')
  })

  it('builds a tmux startup command that launches OMX with the required defaults', () => {
    const command = buildOmxStartupCommand({
      cwd: '/tmp/project',
      tmuxSessionName: 'hive-omx-session-123'
    })

    expect(command).toContain("tmux has-session -t 'hive-omx-session-123'")
    expect(command).toContain(
      "tmux new-session -d -s 'hive-omx-session-123' -c '/tmp/project' 'omx' '--madmax' '--high'"
    )
    expect(command).toContain('extended-keys on')
    expect(command).toContain("tmux attach-session -t 'hive-omx-session-123'")
  })

  it('parses OMX status output into structured mode entries', () => {
    const parsed = parseOmxStatusOutput(
      ['ralph: ACTIVE (phase: executing)', 'team: inactive (phase: complete)'].join('\n')
    )

    expect(parsed).toEqual([
      { mode: 'ralph', active: true, phase: 'executing' },
      { mode: 'team', active: false, phase: 'complete' }
    ])
  })

  it('ignores non-status lines', () => {
    expect(parseOmxStatusOutput('No active modes.')).toEqual([])
    expect(parseOmxStatusOutput('notify-fallback: inactive (phase: n/a)\ninvalid line')).toEqual([
      { mode: 'notify-fallback', active: false, phase: 'n/a' }
    ])
  })
})
