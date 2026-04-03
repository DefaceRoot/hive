import { describe, expect, it } from 'vitest'
import {
  buildOmxBootstrapCommand,
  buildOmxTmuxSessionName,
  parseOmxStatusOutput
} from '../src/main/services/omx-service'

describe('omx-service', () => {
  it('builds a stable tmux session name', () => {
    expect(buildOmxTmuxSessionName('session-123')).toBe('hive-omx-session-123')
    expect(buildOmxTmuxSessionName('weird/session:id')).toBe('hive-omx-weirdsessionid')
  })

  it('builds an attach-or-create bootstrap command', () => {
    const command = buildOmxBootstrapCommand({
      tmuxSessionName: 'hive-omx-session-123',
      cwd: '/tmp/project'
    })

    expect(command).toContain('tmux has-session -t')
    expect(command).toContain('tmux new-session -d -s')
    expect(command).toContain("'omx' '--madmax' '--high'")
    expect(command).toContain('tmux attach-session -t')
    expect(command).toContain('extended-keys on')
  })

  it('parses active omx modes and filters inactive notify-fallback noise', () => {
    const parsed = parseOmxStatusOutput(`
notify-fallback: inactive (phase: n/a)
ralph: ACTIVE (phase: executing)
team: inactive (phase: complete)
`)

    expect(parsed).toEqual([
      { mode: 'ralph', active: true, phase: 'executing' },
      { mode: 'team', active: false, phase: 'complete' }
    ])
  })
})
