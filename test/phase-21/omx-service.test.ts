import { describe, expect, it } from 'vitest'
import { buildOmxStartupCommand, buildOmxTmuxSessionName } from '../../src/main/services/omx-service'

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
})
