import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const terminalOps = {
  write: vi.fn()
}

const omxOps = {
  status: vi.fn().mockResolvedValue({
    success: true,
    modes: [{ mode: 'ralph', active: true, phase: 'executing' }]
  }),
  killSession: vi.fn()
}

Object.defineProperty(window, 'terminalOps', {
  writable: true,
  configurable: true,
  value: terminalOps
})

Object.defineProperty(window, 'omxOps', {
  writable: true,
  configurable: true,
  value: omxOps
})

vi.mock('@/components/terminal/TerminalView', () => ({
  TerminalView: ({ startupCommand }: { startupCommand?: string }) => (
    <div data-testid="mock-terminal-view" data-startup-command={startupCommand ?? ''} />
  )
}))

import { OmxSessionView } from '@/components/sessions/OmxSessionView'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorktreeStore } from '@/stores/useWorktreeStore'

describe('OmxSessionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useSessionStore.setState((state) => ({
      ...state,
      sessionsByWorktree: new Map([
        [
          'wt-1',
          [
            {
              id: 'session-1',
              worktree_id: 'wt-1',
              project_id: 'proj-1',
              connection_id: null,
              name: 'OMX 1',
              status: 'active',
              opencode_session_id: 'hive-omx-wt-123',
              agent_sdk: 'omx',
              mode: 'build',
              model_provider_id: null,
              model_id: null,
              model_variant: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              completed_at: null
            }
          ]
        ]
      ]),
      sessionsByConnection: new Map()
    }))

    useWorktreeStore.setState((state) => ({
      ...state,
      worktreesByProject: new Map([
        [
          'proj-1',
          [
            {
              id: 'wt-1',
              project_id: 'proj-1',
              name: 'feature-omx',
              branch_name: 'feature-omx',
              path: '/tmp/hive-omx-project',
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
              base_branch: 'main',
              created_at: '2026-01-01T00:00:00Z',
              last_accessed_at: '2026-01-01T00:00:00Z'
            }
          ]
        ]
      ])
    }))

    useConnectionStore.setState((state) => ({
      ...state,
      connections: []
    }))
  })

  it('renders OMX status and injects quick actions into the terminal session', async () => {
    render(<OmxSessionView sessionId="session-1" />)

    await waitFor(() => {
      expect(omxOps.status).toHaveBeenCalledWith('/tmp/hive-omx-project')
    })

    expect(screen.getByTestId('mock-terminal-view')).toHaveAttribute(
      'data-startup-command',
      expect.stringContaining('omx --madmax --high')
    )
    await waitFor(() => {
      expect(screen.getByTestId('omx-status-ralph')).toHaveTextContent('ralph: executing')
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('omx-quick-plan'))
    })
    expect(terminalOps.write).toHaveBeenCalledWith('session-1', '$plan\r')
  })

  it('sends composer text into the OMX terminal session', async () => {
    render(<OmxSessionView sessionId="session-1" />)

    await act(async () => {
      fireEvent.change(screen.getByTestId('omx-prompt-input'), {
        target: { value: 'Ship the integration' }
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })

    expect(terminalOps.write).toHaveBeenCalledWith('session-1', 'Ship the integration\r')
  })
})
