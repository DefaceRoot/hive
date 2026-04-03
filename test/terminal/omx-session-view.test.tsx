import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OmxSessionView } from '../../src/renderer/src/components/sessions/OmxSessionView'
import { useConnectionStore } from '../../src/renderer/src/stores/useConnectionStore'
import { useSessionStore } from '../../src/renderer/src/stores/useSessionStore'
import { useWorktreeStore } from '../../src/renderer/src/stores/useWorktreeStore'

const mockBuildStartupCommand = vi.fn().mockResolvedValue({
  success: true,
  command: "tmux attach-session -t 'hive-omx-test'"
})
const mockStatus = vi.fn().mockResolvedValue({
  success: true,
  modes: [{ mode: 'ralph', active: true, phase: 'running' }]
})
const mockTerminalWrite = vi.fn()

vi.mock('@/components/terminal/TerminalView', () => ({
  TerminalView: ({
    worktreeId,
    cwd,
    startupCommand
  }: {
    worktreeId: string
    cwd: string
    startupCommand?: string
  }) => (
    <div
      data-testid={`terminal-view-${worktreeId}`}
      data-cwd={cwd}
      data-startup-command={startupCommand ?? ''}
    />
  )
}))

describe('OmxSessionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(window, 'omxOps', {
      configurable: true,
      writable: true,
      value: {
        buildStartupCommand: mockBuildStartupCommand,
        status: mockStatus,
        shutdownSession: vi.fn()
      }
    })

    Object.defineProperty(window, 'terminalOps', {
      configurable: true,
      writable: true,
      value: {
        write: mockTerminalWrite
      }
    })

    act(() => {
      useWorktreeStore.setState({
        worktreesByProject: new Map([
          [
            'proj-1',
            [
              {
                id: 'wt-1',
                project_id: 'proj-1',
                name: 'main',
                branch_name: 'main',
                path: '/tmp/hive-omx-project',
                status: 'active',
                is_default: true,
                branch_renamed: 0,
                last_message_at: null,
                session_titles: '[]',
                last_model_provider_id: null,
                last_model_id: null,
                last_model_variant: null,
                created_at: '2026-01-01T00:00:00.000Z',
                last_accessed_at: '2026-01-01T00:00:00.000Z'
              }
            ]
          ]
        ])
      })

      useConnectionStore.setState({ connections: [] })

      useSessionStore.setState({
        sessionsByWorktree: new Map([
          [
            'wt-1',
            [
              {
                id: 'omx-1',
                worktree_id: 'wt-1',
                project_id: 'proj-1',
                connection_id: null,
                name: 'OMX 1',
                status: 'active',
                opencode_session_id: 'hive-omx-test',
                agent_sdk: 'omx',
                mode: 'build',
                model_provider_id: null,
                model_id: null,
                model_variant: null,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
                completed_at: null
              }
            ]
          ]
        ]),
        sessionsByConnection: new Map()
      })
    })
  })

  test('builds the tmux startup command and renders terminal metadata', async () => {
    render(<OmxSessionView sessionId="omx-1" isVisible />)

    expect(await screen.findByTestId('terminal-view-omx-1')).toHaveAttribute(
      'data-cwd',
      '/tmp/hive-omx-project'
    )
    expect(screen.getByText(/tmux: hive-omx-test/i)).toBeInTheDocument()
    expect(await screen.findByText(/ralph/i)).toBeInTheDocument()
  })

  test('quick actions and composer send commands into the OMX terminal', async () => {
    const user = userEvent.setup()
    render(<OmxSessionView sessionId="omx-1" isVisible />)

    await user.click(await screen.findByTestId('omx-quick-plan'))
    expect(mockTerminalWrite).toHaveBeenCalledWith('omx-1', '$plan\r')

    await user.type(screen.getByTestId('omx-prompt-input'), 'Ship the integration')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(mockTerminalWrite).toHaveBeenCalledWith('omx-1', 'Ship the integration\r')
  })
})
