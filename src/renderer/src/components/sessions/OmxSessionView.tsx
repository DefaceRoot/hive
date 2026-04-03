import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, Map, RefreshCw, Square, Users, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TerminalView } from '@/components/terminal/TerminalView'
import { cn } from '@/lib/utils'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorktreeStore } from '@/stores/useWorktreeStore'

interface OmxSessionViewProps {
  sessionId: string
  isVisible?: boolean
}

interface OmxModeStatus {
  mode: string
  active: boolean
  phase: string
}

function findSession(sessionId: string) {
  const state = useSessionStore.getState()
  for (const sessions of state.sessionsByWorktree.values()) {
    const found = sessions.find((session) => session.id === sessionId)
    if (found) return found
  }
  for (const sessions of state.sessionsByConnection.values()) {
    const found = sessions.find((session) => session.id === sessionId)
    if (found) return found
  }
  return null
}

function resolveSessionCwd(sessionId: string): string | null {
  const session = findSession(sessionId)
  if (!session) return null

  if (session.worktree_id) {
    const worktreesByProject = useWorktreeStore.getState().worktreesByProject
    for (const worktrees of worktreesByProject.values()) {
      const match = worktrees.find((worktree) => worktree.id === session.worktree_id)
      if (match?.path) return match.path
    }
  }

  if (session.connection_id) {
    const connection = useConnectionStore
      .getState()
      .connections.find((candidate) => candidate.id === session.connection_id)
    const member = connection?.members?.[0]
    if (!member) return null

    const worktreesByProject = useWorktreeStore.getState().worktreesByProject
    for (const worktrees of worktreesByProject.values()) {
      const match = worktrees.find((worktree) => worktree.id === member.worktree_id)
      if (match?.path) return match.path
    }
  }

  return null
}

const QUICK_COMMANDS = [
  { label: 'Plan', value: '$plan', icon: Map },
  { label: 'Ralph', value: '$ralph', icon: Wand2 },
  { label: 'Team', value: '$team', icon: Users },
  { label: 'Cancel', value: '$cancel', icon: Square },
  { label: 'Status', value: 'omx status', icon: Activity }
] as const

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function buildOmxStartupCommand(cwd: string, tmuxSessionName: string): string {
  const quotedSession = quoteShellArg(tmuxSessionName)
  const quotedCwd = quoteShellArg(cwd)
  return [
    `tmux has-session -t ${quotedSession} 2>/dev/null || tmux new-session -d -s ${quotedSession} -c ${quotedCwd} 'omx --madmax --high'`,
    'tmux set-option -s extended-keys on >/dev/null 2>&1 || true',
    'tmux set-option -s extended-keys-format csi-u >/dev/null 2>&1 || true',
    `tmux set-option -t ${quotedSession} -g mouse on >/dev/null 2>&1 || true`,
    `tmux attach-session -t ${quotedSession}`
  ].join('; ')
}

export function OmxSessionView({
  sessionId,
  isVisible = true
}: OmxSessionViewProps): React.JSX.Element {
  const session = useSessionStore(() => findSession(sessionId))
  const resolvedCwd = useMemo(() => resolveSessionCwd(sessionId), [sessionId])
  const [lastKnownCwd, setLastKnownCwd] = useState<string | null>(null)
  const [modes, setModes] = useState<OmxModeStatus[]>([])
  const [statusError, setStatusError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const cwd = resolvedCwd || lastKnownCwd
  const tmuxSessionName = session?.opencode_session_id ?? null
  const startupCommand = useMemo(() => {
    if (!cwd || !tmuxSessionName) return undefined
    return buildOmxStartupCommand(cwd, tmuxSessionName)
  }, [cwd, tmuxSessionName])

  useEffect(() => {
    if (!resolvedCwd) return
    setLastKnownCwd((current) => (current === resolvedCwd ? current : resolvedCwd))
  }, [resolvedCwd])

  const refreshStatus = useCallback(async () => {
    if (!cwd) return
    const result = await window.omxOps.status(cwd)
    if (!result.success) {
      setStatusError(result.error || 'Failed to load OMX status')
      setModes([])
      return
    }
    setStatusError(null)
    setModes(result.modes)
  }, [cwd])

  useEffect(() => {
    if (!cwd) return
    void refreshStatus()
    const interval = window.setInterval(() => {
      void refreshStatus()
    }, 3000)
    return () => window.clearInterval(interval)
  }, [cwd, refreshStatus])

  const sendRaw = useCallback(
    (text: string) => {
      const normalized = text.replace(/\r?\n/g, '\r')
      window.terminalOps.write(sessionId, `${normalized}\r`)
    },
    [sessionId]
  )

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    sendRaw(trimmed)
    setDraft('')
  }, [draft, sendRaw])

  if (!cwd || !tmuxSessionName) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Preparing OMX session…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="omx-session-view">
      <div className="border-b border-border bg-muted/20 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Oh My Codex</div>
            <div className="text-xs text-muted-foreground truncate">
              tmux: {tmuxSessionName} · launch: omx --madmax --high
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshStatus()}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Status
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_COMMANDS.map(({ label, value, icon: Icon }) => (
            <Button
              key={value}
              variant="outline"
              size="sm"
              onClick={() => sendRaw(value)}
              className="gap-1.5"
              data-testid={`omx-quick-${label.toLowerCase()}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!startupCommand ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Preparing OMX bootstrap…
            </span>
          ) : modes.length > 0 ? (
            modes.map((mode) => (
              <span
                key={mode.mode}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  mode.active
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                    : 'border-border bg-background text-muted-foreground'
                )}
              >
                <span>{mode.mode}</span>
                <span className="opacity-70">· {mode.phase}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No active OMX modes</span>
          )}
          {statusError && <span className="text-xs text-destructive">{statusError}</span>}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSubmit()
              }
            }}
            rows={2}
            placeholder="Send text into the OMX session, e.g. $plan or a task prompt"
            data-testid="omx-prompt-input"
          />
          <Button onClick={handleSubmit} disabled={draft.trim().length === 0}>
            Send
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TerminalView
          worktreeId={sessionId}
          cwd={cwd}
          startupCommand={startupCommand}
          isVisible={isVisible}
        />
      </div>
    </div>
  )
}
