import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionStore } from '../../src/renderer/src/stores/useSessionStore'

function makeTerminalSession(id: string, worktreeId: string) {
  return {
    id,
    worktree_id: worktreeId,
    project_id: 'proj-1',
    connection_id: null,
    name: id,
    status: 'active' as const,
    opencode_session_id: null,
    agent_sdk: 'terminal' as const,
    mode: 'build' as const,
    model_provider_id: null,
    model_id: null,
    model_variant: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: null
  }
}

function makeOmxSession(id: string, worktreeId: string, tmuxSessionName = 'hive-omx-test') {
  return {
    ...makeTerminalSession(id, worktreeId),
    opencode_session_id: tmuxSessionName,
    agent_sdk: 'omx' as const
  }
}

describe('closedTerminalSessionIds signal', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'db', {
      value: {
        session: {
          update: vi.fn().mockResolvedValue(undefined)
        }
      },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'terminalOps', {
      value: {
        destroy: vi.fn().mockResolvedValue(undefined)
      },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'omxOps', {
      value: {
        shutdownSession: vi.fn().mockResolvedValue({ success: true })
      },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'omxOps', {
      value: {
        shutdownSession: vi.fn().mockResolvedValue({ success: true })
      },
      writable: true,
      configurable: true
    })

    act(() => {
      useSessionStore.setState({
        activeSessionId: 'term-1',
        activeWorktreeId: 'wt-1',
        activeConnectionId: null,
        inlineConnectionSessionId: null,
        isLoading: false,
        closedTerminalSessionIds: new Set(),
        sessionsByWorktree: new Map([
          ['wt-1', [makeTerminalSession('term-1', 'wt-1'), makeTerminalSession('term-2', 'wt-1')]]
        ]),
        sessionsByConnection: new Map(),
        tabOrderByWorktree: new Map([['wt-1', ['term-1', 'term-2']]]),
        tabOrderByConnection: new Map(),
        activeSessionByWorktree: { 'wt-1': 'term-1' },
        activeSessionByConnection: {}
      })
    })
  })

  test('closeSession adds terminal session ID to closedTerminalSessionIds', async () => {
    expect(useSessionStore.getState().closedTerminalSessionIds.size).toBe(0)

    await act(async () => {
      await useSessionStore.getState().closeSession('term-1')
    })

    expect(useSessionStore.getState().closedTerminalSessionIds.has('term-1')).toBe(true)
  })

  test('closeSession does NOT add non-terminal session ID to closedTerminalSessionIds', async () => {
    act(() => {
      useSessionStore.setState({
        sessionsByWorktree: new Map([
          [
            'wt-1',
            [
              { ...makeTerminalSession('oc-1', 'wt-1'), agent_sdk: 'opencode' as const },
              makeTerminalSession('term-2', 'wt-1')
            ]
          ]
        ]),
        activeSessionId: 'oc-1',
        tabOrderByWorktree: new Map([['wt-1', ['oc-1', 'term-2']]])
      })
    })

    await act(async () => {
      await useSessionStore.getState().closeSession('oc-1')
    })

    expect(useSessionStore.getState().closedTerminalSessionIds.size).toBe(0)
  })

  test('acknowledgeClosedTerminals removes IDs from the set', async () => {
    await act(async () => {
      await useSessionStore.getState().closeSession('term-1')
    })

    expect(useSessionStore.getState().closedTerminalSessionIds.has('term-1')).toBe(true)

    act(() => {
      useSessionStore.getState().acknowledgeClosedTerminals(new Set(['term-1']))
    })

    expect(useSessionStore.getState().closedTerminalSessionIds.size).toBe(0)
  })

  test('closeSession shuts down OMX tmux sessions before destroying the terminal PTY', async () => {
    act(() => {
      useSessionStore.setState({
        sessionsByWorktree: new Map([['wt-1', [makeOmxSession('omx-1', 'wt-1', 'hive-omx-wt-1')]]]),
        activeSessionId: 'omx-1',
        tabOrderByWorktree: new Map([['wt-1', ['omx-1']]])
      })
    })

    await act(async () => {
      await useSessionStore.getState().closeSession('omx-1')
    })

    expect(window.omxOps.shutdownSession).toHaveBeenCalledWith('hive-omx-wt-1')
    expect(window.terminalOps.destroy).toHaveBeenCalledWith('omx-1')
    expect(useSessionStore.getState().closedTerminalSessionIds.has('omx-1')).toBe(true)
  })

  test('closeSession shuts down OMX tmux sessions before removing the tab', async () => {
    act(() => {
      useSessionStore.setState({
        sessionsByWorktree: new Map([
          [
            'wt-1',
            [
              {
                ...makeTerminalSession('omx-1', 'wt-1'),
                opencode_session_id: 'hive-omx-session-1',
                agent_sdk: 'omx' as const
              }
            ]
          ]
        ]),
        activeSessionId: 'omx-1',
        tabOrderByWorktree: new Map([['wt-1', ['omx-1']]])
      })
    })

    await act(async () => {
      await useSessionStore.getState().closeSession('omx-1')
    })

    expect(window.omxOps.shutdownSession).toHaveBeenCalledWith('hive-omx-session-1')
    expect(window.terminalOps.destroy).toHaveBeenCalledWith('omx-1')
    expect(useSessionStore.getState().closedTerminalSessionIds.has('omx-1')).toBe(true)
  })
})

function makeConnectionTerminalSession(id: string, connectionId: string) {
  return {
    id,
    worktree_id: null,
    project_id: 'proj-1',
    connection_id: connectionId,
    name: id,
    status: 'active' as const,
    opencode_session_id: null,
    agent_sdk: 'terminal' as const,
    mode: 'build' as const,
    model_provider_id: null,
    model_id: null,
    model_variant: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: null
  }
}

describe('setSessionModel with connection terminal sessions', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'db', {
      value: {
        session: { update: vi.fn().mockResolvedValue(undefined) },
        worktree: { updateModel: vi.fn().mockResolvedValue(undefined) }
      },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'opencodeOps', {
      value: {
        setModel: vi.fn().mockResolvedValue(undefined)
      },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'terminalOps', {
      value: { destroy: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true
    })

    act(() => {
      useSessionStore.setState({
        activeSessionId: 'conn-term-1',
        activeWorktreeId: null,
        activeConnectionId: 'conn-1',
        inlineConnectionSessionId: null,
        isLoading: false,
        closedTerminalSessionIds: new Set(),
        sessionsByWorktree: new Map(),
        sessionsByConnection: new Map([
          ['conn-1', [makeConnectionTerminalSession('conn-term-1', 'conn-1')]]
        ]),
        tabOrderByWorktree: new Map(),
        tabOrderByConnection: new Map([['conn-1', ['conn-term-1']]]),
        activeSessionByWorktree: {},
        activeSessionByConnection: { 'conn-1': 'conn-term-1' }
      })
    })
  })

  test('does NOT call opencodeOps.setModel for connection-scoped terminal sessions', async () => {
    await act(async () => {
      await useSessionStore.getState().setSessionModel('conn-term-1', {
        providerID: 'anthropic',
        modelID: 'claude-4',
        variant: null
      })
    })

    expect(window.opencodeOps.setModel).not.toHaveBeenCalled()
  })
})
