import { useEffect, useMemo, useState } from 'react'
import { TerminalView } from '@/components/terminal/TerminalView'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorktreeStore } from '@/stores/useWorktreeStore'
import { useConnectionStore } from '@/stores/useConnectionStore'

interface SessionTerminalViewProps {
  sessionId: string
  /** Whether this terminal is currently visible (not hidden by CSS). Controls fit/focus and Ghostty frame sync. */
  isVisible?: boolean
}

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `"'"'"`)}'`
}

function buildOmxStartupCommand(cwd: string, tmuxSessionName: string): string {
  const quotedSession = quoteShellArg(tmuxSessionName)
  const quotedCwd = quoteShellArg(cwd)
  return [
    `tmux has-session -t ${quotedSession} 2>/dev/null || tmux new-session -d -s ${quotedSession} -c ${quotedCwd} 'omx' '--madmax' '--high'`,
    'tmux set-option -s extended-keys on >/dev/null 2>&1 || true',
    'tmux set-option -s extended-keys-format csi-u >/dev/null 2>&1 || true',
    `tmux set-option -t ${quotedSession} -g mouse on >/dev/null 2>&1 || true`,
    `tmux attach-session -t ${quotedSession}`
  ].join('; ')
}

/**
 * Renders a full-size terminal for "terminal" agent_sdk sessions.
 * Uses the session ID as the PTY key (not worktree ID) to avoid
 * conflicts with the bottom-panel terminal.
 */
export function SessionTerminalView({
  sessionId,
  isVisible = true
}: SessionTerminalViewProps): React.JSX.Element {
  // Look up the session to find its worktree_id or connection_id
  const session = useSessionStore((state) => {
    for (const sessions of state.sessionsByWorktree.values()) {
      const found = sessions.find((s) => s.id === sessionId)
      if (found) return found
    }
    for (const sessions of state.sessionsByConnection.values()) {
      const found = sessions.find((s) => s.id === sessionId)
      if (found) return found
    }
    return null
  })

  // Resolve the working directory from the session's worktree
  const resolvedCwd = useMemo(() => {
    if (!session) return null

    // Direct worktree session
    if (session.worktree_id) {
      const worktreesByProject = useWorktreeStore.getState().worktreesByProject
      for (const worktrees of worktreesByProject.values()) {
        const wt = worktrees.find((w) => w.id === session.worktree_id)
        if (wt?.path) return wt.path
      }
    }

    // Connection session — use the first member's worktree path
    if (session.connection_id) {
      const connections = useConnectionStore.getState().connections
      const connection = connections.find((c) => c.id === session.connection_id)
      if (connection?.members?.[0]) {
        const worktreesByProject = useWorktreeStore.getState().worktreesByProject
        for (const worktrees of worktreesByProject.values()) {
          const wt = worktrees.find((w) => w.id === connection.members[0].worktree_id)
          if (wt?.path) return wt.path
        }
      }
    }

    return null
  }, [session])

  const [lastKnownCwd, setLastKnownCwd] = useState<string | null>(null)

  useEffect(() => {
    if (!resolvedCwd) return
    setLastKnownCwd((current) => (current === resolvedCwd ? current : resolvedCwd))
  }, [resolvedCwd])

  const cwd = resolvedCwd || lastKnownCwd
  const [startupCommand, setStartupCommand] = useState<string | undefined>(undefined)
  const isOmxSession = session?.agent_sdk === 'omx'
  const tmuxSessionName = isOmxSession ? session?.opencode_session_id ?? null : null

  useEffect(() => {
    if (!isOmxSession || !cwd || !tmuxSessionName) {
      setStartupCommand(undefined)
      return
    }

    let cancelled = false
    const fallbackCommand = buildOmxStartupCommand(cwd, tmuxSessionName)
    const buildCommand = window.omxOps?.buildStartupCommand
      ? window.omxOps.buildStartupCommand({ cwd, tmuxSessionName })
      : Promise.resolve({ success: true, command: fallbackCommand })

    buildCommand
      .then((result) => {
        if (cancelled) return
        setStartupCommand(result.success ? result.command : fallbackCommand)
      })
      .catch(() => {
        if (!cancelled) setStartupCommand(fallbackCommand)
      })

    return () => {
      cancelled = true
    }
  }, [cwd, isOmxSession, tmuxSessionName])

  if (!cwd) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading terminal...</p>
      </div>
    )
  }

  if (isOmxSession && !startupCommand) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Preparing OMX terminal...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="session-terminal-view">
      <TerminalView
        worktreeId={sessionId}
        cwd={cwd}
        startupCommand={startupCommand}
        isVisible={isVisible}
      />
    </div>
  )
}
