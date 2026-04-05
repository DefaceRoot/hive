import type { BrowserWindow } from 'electron'
import type { DatabaseService } from '../db/database'
import type { AgentSdkImplementer } from './agent-sdk-types'
import { OMX_CAPABILITIES } from './agent-sdk-types'
import {
  buildOmxTmuxSessionName,
  ensureOmxTmuxSession,
  interruptOmxTmuxSession,
  sendTextToOmxTmuxSession
} from './omx-service'

export class OmxImplementer implements AgentSdkImplementer {
  readonly id = 'omx' as const
  readonly capabilities = OMX_CAPABILITIES

  private db: DatabaseService | null = null

  setDatabaseService(db: DatabaseService): void {
    this.db = db
  }

  async connect(_worktreePath: string, hiveSessionId: string): Promise<{ sessionId: string }> {
    const session = this.db?.getSession(hiveSessionId)
    const tmuxSessionName = session?.opencode_session_id || buildOmxTmuxSessionName(hiveSessionId)
    await ensureOmxTmuxSession(_worktreePath, tmuxSessionName)
    return { sessionId: tmuxSessionName }
  }

  async reconnect(
    worktreePath: string,
    agentSessionId: string
  ): Promise<{
    success: boolean
    sessionStatus?: 'idle' | 'busy' | 'retry'
    revertMessageID?: string | null
  }> {
    await ensureOmxTmuxSession(worktreePath, agentSessionId)
    return { success: true, sessionStatus: 'idle' }
  }

  async disconnect(): Promise<void> {}

  async cleanup(): Promise<void> {}

  async prompt(
    _worktreePath: string,
    agentSessionId: string,
    message:
      | string
      | Array<
          | { type: 'text'; text: string }
          | { type: 'file'; mime: string; url: string; filename?: string }
        >
  ): Promise<void> {
    await sendTextToOmxTmuxSession(agentSessionId, message)
  }

  async abort(_worktreePath: string, agentSessionId: string): Promise<boolean> {
    await interruptOmxTmuxSession(agentSessionId)
    return true
  }

  async getMessages(): Promise<unknown[]> {
    return []
  }

  async getAvailableModels(): Promise<unknown> {
    return {}
  }

  async getModelInfo(): Promise<{
    id: string
    name: string
    limit: { context: number; input?: number; output: number }
  } | null> {
    return null
  }

  setSelectedModel(): void {}

  async getSessionInfo(): Promise<{
    revertMessageID: string | null
    revertDiff: string | null
  }> {
    return {
      revertMessageID: null,
      revertDiff: null
    }
  }

  async questionReply(): Promise<void> {}

  async questionReject(): Promise<void> {}

  async permissionReply(): Promise<void> {}

  async permissionList(): Promise<unknown[]> {
    return []
  }

  async undo(): Promise<unknown> {
    return {}
  }

  async redo(): Promise<unknown> {
    return {}
  }

  async listCommands(): Promise<unknown[]> {
    return []
  }

  async sendCommand(
    _worktreePath: string,
    _agentSessionId: string,
    _command: string,
    _args?: string
  ): Promise<void> {}

  async renameSession(): Promise<void> {}

  setMainWindow(_window: BrowserWindow): void {}
}
