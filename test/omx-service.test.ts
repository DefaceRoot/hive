import { describe, expect, it } from 'vitest'
import { buildOmxBootstrapCommand, buildOmxTmuxSessionName } from '../src/main/services/omx-service'

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
})
