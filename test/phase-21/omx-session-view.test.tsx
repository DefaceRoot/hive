import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OmxSessionView } from '../../src/renderer/src/components/sessions/OmxSessionView'
import { useConnectionStore } from '../../src/renderer/src/stores/useConnectionStore'
import { useSessionStore } from '../../src/renderer/src/stores/useSessionStore'
import { useWorktreeStore } from '../../src/renderer/src/stores/useWorktreeStore'

vi.mock('../../src/renderer/src/components/terminal/TerminalView', () => ({
  TerminalView: ({ startupCommand }: { startupCommand?: string }) => (
    <div data-testid="mock-terminal">{startupCommand ?? 'no-startup-command'}</div>
  )
}))

describe('OmxSessionView', () => {
  const buildStartupCommandMock = vi.fn()
  const statusMock = vi.fn()
  const shutdownSessionMock = vi.fn()
  const terminalWriteMock = vi.fn()

  beforeEach(() => {
    buildStartupCommandMock.mockReset()
    statusMock.mockReset()
    shutdownSessionMock.mockReset()
    terminalWriteMock.mockReset()

    buildStartupCommandMock.mockResolvedValue({
      success: true,
      command: 'tmux attach-session -t hive-omx-test'
    })
    statusMock.mockResolvedValue({
      success: true,
      modes: [{ mode: 'ralph', active: true, phase: 'executing' }]
    })
    shutdownSessionMock.mockResolvedValue({ success: true })

    ;(window as typeof window & { omxOps: unknown }).omxOps = {
      buildStartupCommand: buildStartupCommandMock,
      status: statusMock,
      shutdownSession: shutdownSessionMock
    } as typeof window.omxOps

    ;(window as typeof window & { terminalOps: unknown }).terminalOps = {
      write: terminalWriteMock
    } as typeof window.terminalOps

    useSessionStore.setState({
      sessionsByWorktree: new Map([
        [
          'wt-1',
          [
            {
              id: 'session-1',
              worktree_id: 'wt-1',
              project_id: 'project-1',
              connection_id: null,
              name: 'OMX 1',
              status: 'active',
              opencode_session_id: 'hive-omx-test',
              agent_sdk: 'omx',
              mode: 'build',
              model_provider_id: null,
              model_id: null,
              model_variant: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null
            }
          ]
        ]
      ]),
      sessionsByConnection: new Map(),
      activeSessionId: 'session-1'
    })

    useWorktreeStore.setState({
      worktreesByProject: new Map([
        [
          'project-1',
          [
            {
              id: 'wt-1',
              project_id: 'project-1',
              name: 'Worktree',
              branch_name: 'main',
              path: '/tmp/project',
              status: 'active',
              is_default: false,
              branch_renamed: 0,
              last_message_at: null,
              session_titles: '[]',
              last_model_provider_id: null,
              last_model_id: null,
              last_model_variant: null,
              attachments: '[]',
              pinned: 0,
              context: null,
              github_pr_number: null,
              github_pr_url: null,
              base_branch: null,
              created_at: new Date().toISOString(),
              last_accessed_at: new Date().toISOString()
            }
          ]
        ]
      ])
    } as Partial<ReturnType<typeof useWorktreeStore.getState>>)

    useConnectionStore.setState({ connections: [] })
  })

  it('renders startup metadata and status from OMX', async () => {
    render(<OmxSessionView sessionId="session-1" />)

    expect(screen.getByText('Oh My Codex')).toBeInTheDocument()
    await waitFor(() => expect(buildStartupCommandMock).toHaveBeenCalled())
    expect(screen.getByTestId('mock-terminal')).toHaveTextContent('hive-omx-test')
    expect(screen.getByText(/ralph/i)).toBeInTheDocument()
  })

  it('sends quick commands and prompt input to the terminal channel', async () => {
    render(<OmxSessionView sessionId="session-1" />)

    await waitFor(() => expect(buildStartupCommandMock).toHaveBeenCalled())

    fireEvent.click(screen.getByTestId('omx-quick-plan'))
    expect(terminalWriteMock).toHaveBeenCalledWith('session-1', '$plan\r')

    fireEvent.change(screen.getByTestId('omx-prompt-input'), {
      target: { value: 'Ship the next step' }
    })
    fireEvent.click(screen.getByText('Send'))

    expect(terminalWriteMock).toHaveBeenCalledWith('session-1', 'Ship the next step\r')
  })
})
