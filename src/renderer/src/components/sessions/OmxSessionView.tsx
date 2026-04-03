import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Map,
  Square,
  Users,
  Workflow
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TerminalView } from '@/components/terminal/TerminalView'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useWorktreeStore } from '@/stores/useWorktreeStore'

interface OmxSessionViewProps {
  sessionId: string
  isVisible?: boolean
}

interface OmxQuickAction {
  id: string
  label: string
  command: string
  icon: typeof Map
  accentClassName: string
}

interface OmxModeStatus {
  mode: string
  active: boolean
  phase: string
}

const QUICK_ACTIONS: OmxQuickAction[] = [
  {
    id: 'plan',
    label: 'Plan',
    command: '$plan',
    icon: Map,
    accentClassName: 'text-violet-300 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20'
  },
  {
    id: 'ralph',
    label: 'Ralph',
    command: '$ralph',
    icon: Workflow,
    accentClassName: 'text-blue-300 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20'
  },
  {
    id: 'team',
    label: 'Team',
    command: '$team',
    icon: Users,
    accentClassName: 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
  },
  {
    id: 'cancel',
    label: 'Cancel',
    command: '$cancel',
    icon: Square,
    accentClassName: 'text-rose-300 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20'
  },
  {
    id: 'status',
    label: 'Status',
    command: 'omx status',
    icon: Activity,
    accentClassName: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
  }
]

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function buildOmxStartupCommand(cwd: string, tmuxSessionId: string): string {
  const quotedSessionId = quoteShellArg(tmuxSessionId)
  const quotedCwd = quoteShellArg(cwd)
  return [
    `tmux has-session -t ${quotedSessionId} 2>/dev/null || tmux new-session -d -s ${quotedSessionId} -c ${quotedCwd} 'omx --madmax --high'`,
    'tmux set-option -s extended-keys on >/dev/null 2>&1 || true',
    'tmux set-option -s extended-keys-format csi-u >/dev/null 2>&1 || true',
    'tmux set-option -g mouse on >/dev/null 2>&1 || true',
    `tmux attach-session -t ${quotedSessionId}`
  ].join('; ')
}

export function OmxSessionView({
  sessionId,
  isVisible = true
}: OmxSessionViewProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [modeStatuses, setModeStatuses] = useState<OmxModeStatus[]>([])

  const session = useSessionStore((state) => {
    for (const sessions of state.sessionsByWorktree.values()) {
      const found = sessions.find((candidate) => candidate.id === sessionId)
      if (found) return found
    }
    for (const sessions of state.sessionsByConnection.values()) {
      const found = sessions.find((candidate) => candidate.id === sessionId)
      if (found) return found
    }
    return null
  })

  const resolvedCwd = useMemo(() => {
    if (!session) return null

    if (session.worktree_id) {
      const worktreesByProject = useWorktreeStore.getState().worktreesByProject
      for (const worktrees of worktreesByProject.values()) {
        const worktree = worktrees.find((candidate) => candidate.id === session.worktree_id)
        if (worktree?.path) return worktree.path
      }
    }

    if (session.connection_id) {
      const connection = useConnectionStore
        .getState()
        .connections.find((candidate) => candidate.id === session.connection_id)
      const primaryMember = connection?.members?.[0]
      if (primaryMember) {
        const worktreesByProject = useWorktreeStore.getState().worktreesByProject
        for (const worktrees of worktreesByProject.values()) {
          const worktree = worktrees.find((candidate) => candidate.id === primaryMember.worktree_id)
          if (worktree?.path) return worktree.path
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
  const tmuxSessionId = session?.opencode_session_id ?? `hive-omx-${sessionId}`
  const startupCommand = cwd ? buildOmxStartupCommand(cwd, tmuxSessionId) : undefined

  const sendToOmx = (command: string): void => {
    if (!command.trim()) return
    window.terminalOps.write(sessionId, `${command}\r`)
  }

  const handleSubmit = (): void => {
    const next = draft.trim()
    if (!next) return
    sendToOmx(next)
    setDraft('')
  }

  useEffect(() => {
    if (!cwd) return

    let cancelled = false

    const refresh = async (): Promise<void> => {
      const result = await window.omxOps.status(cwd)
      if (!cancelled && result.success) {
        setModeStatuses(result.modes)
      }
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [cwd])

  if (!cwd) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading OMX session...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="omx-session-view">
      <div className="border-b border-border bg-muted/20 px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
            OMX
          </span>
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            tmux: {tmuxSessionId}
          </span>
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            launch: omx --madmax --high
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                size="sm"
                className={cn('text-xs', action.accentClassName)}
                data-testid={`omx-quick-action-${action.id}`}
                onClick={() => sendToOmx(action.command)}
              >
                <Icon className="h-3.5 w-3.5" />
                {action.label}
              </Button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {modeStatuses.length > 0 ? (
            modeStatuses.map((status) => (
              <span
                key={status.mode}
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  status.active
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground'
                )}
                data-testid={`omx-status-${status.mode}`}
              >
                {status.mode}: {status.phase}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              No active OMX modes
            </span>
          )}
        </div>

        <div className="rounded-md border border-border/80 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          Hive wraps OMX in a reconnectable tmux session. Quick actions inject real OMX commands,
          and the status pills above are sourced from `omx status`.
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

      <div className="border-t border-border bg-background px-4 py-3">
        <div className="flex items-end gap-3">
          <label className="flex-1 space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              OMX Composer
            </span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSubmit()
                }
              }}
              rows={2}
              placeholder="Send a prompt or OMX command (e.g. $plan, $ralph, $team)"
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="omx-composer"
            />
          </label>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="shrink-0"
            data-testid="omx-send"
          >
            <ArrowRight className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
