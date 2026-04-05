/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers = new Map<string, (...args: any[]) => any>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../../../src/main/services/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../../src/main/services/opencode-service', () => ({
  openCodeService: {
    setMainWindow: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../../../src/main/services/claude-code-implementer', () => ({
  ClaudeCodeImplementer: vi.fn()
}))

vi.mock('../../../src/main/services/codex-implementer', () => ({
  CodexImplementer: vi.fn()
}))

import { registerOpenCodeHandlers } from '../../../src/main/ipc/opencode-handlers'
import { openCodeService } from '../../../src/main/services/opencode-service'
import type { AgentSdkManager } from '../../../src/main/services/agent-sdk-manager'
import type { AgentSdkImplementer } from '../../../src/main/services/agent-sdk-types'

function createMockCodexImpl(): AgentSdkImplementer {
  return {
    id: 'codex',
    capabilities: {
      supportsUndo: true,
      supportsRedo: false,
      supportsCommands: false,
      supportsPermissionRequests: true,
      supportsQuestionPrompts: true,
      supportsModelSelection: true,
      supportsReconnect: true,
      supportsPartialStreaming: true
    },
    connect: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn(),
    cleanup: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(true),
    getMessages: vi.fn().mockResolvedValue([]),
    getAvailableModels: vi.fn().mockResolvedValue([]),
    getModelInfo: vi.fn().mockResolvedValue(null),
    setSelectedModel: vi.fn(),
    getSessionInfo: vi.fn().mockResolvedValue({ revertMessageID: null, revertDiff: null }),
    questionReply: vi.fn(),
    questionReject: vi.fn(),
    permissionReply: vi.fn(),
    permissionList: vi.fn().mockResolvedValue([]),
    undo: vi.fn(),
    redo: vi.fn(),
    listCommands: vi.fn().mockResolvedValue([]),
    sendCommand: vi.fn(),
    renameSession: vi.fn(),
    setMainWindow: vi.fn()
  }
}

function createMockSdkManager(codexImpl: AgentSdkImplementer): AgentSdkManager {
  return {
    getImplementer: vi.fn((id: string) => {
      if (id === 'codex') return codexImpl
      throw new Error(`Unknown agent SDK: ${id}`)
    }),
    getCapabilities: vi.fn(),
    cleanup: vi.fn()
  } as unknown as AgentSdkManager
}

function createMockOmxImpl(): AgentSdkImplementer {
  return {
    id: 'omx',
    capabilities: {
      supportsUndo: false,
      supportsRedo: false,
      supportsCommands: false,
      supportsPermissionRequests: false,
      supportsQuestionPrompts: false,
      supportsModelSelection: false,
      supportsReconnect: true,
      supportsPartialStreaming: false
    },
    connect: vi.fn().mockResolvedValue({ sessionId: 'hive-omx-session-1' }),
    reconnect: vi.fn().mockResolvedValue({ success: true, sessionStatus: 'idle' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    prompt: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(true),
    getMessages: vi.fn().mockResolvedValue([]),
    getAvailableModels: vi.fn().mockResolvedValue({}),
    getModelInfo: vi.fn().mockResolvedValue(null),
    setSelectedModel: vi.fn(),
    getSessionInfo: vi.fn().mockResolvedValue({ revertMessageID: null, revertDiff: null }),
    questionReply: vi.fn(),
    questionReject: vi.fn(),
    permissionReply: vi.fn(),
    permissionList: vi.fn().mockResolvedValue([]),
    undo: vi.fn(),
    redo: vi.fn(),
    listCommands: vi.fn().mockResolvedValue([]),
    sendCommand: vi.fn(),
    renameSession: vi.fn(),
    setMainWindow: vi.fn()
  }
}

function createMockOmxSdkManager(omxImpl: AgentSdkImplementer): AgentSdkManager {
  return {
    getImplementer: vi.fn((id: string) => {
      if (id === 'omx') return omxImpl
      throw new Error(`Unknown agent SDK: ${id}`)
    }),
    getCapabilities: vi.fn(),
    cleanup: vi.fn()
  } as unknown as AgentSdkManager
}

const mockEvent = {} as any

describe('IPC opencode:prompt options routing', () => {
  let codexImpl: AgentSdkImplementer

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    codexImpl = createMockCodexImpl()
  })

  it('passes codexFastMode options to SDK implementers', async () => {
    const sdkManager = createMockSdkManager(codexImpl)
    const dbService = {
      getAgentSdkForSession: vi.fn().mockReturnValue('codex')
    } as any
    const mainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } } as any

    registerOpenCodeHandlers(mainWindow, sdkManager, dbService)

    const handler = handlers.get('opencode:prompt')!
    const result = await handler(mockEvent, {
      worktreePath: '/project',
      sessionId: 'session-1',
      parts: [{ type: 'text', text: 'hello' }],
      model: { providerID: 'codex', modelID: 'gpt-5.3-codex' },
      options: { codexFastMode: true }
    })

    expect(result).toEqual({ success: true })
    expect(codexImpl.prompt).toHaveBeenCalledWith(
      '/project',
      'session-1',
      [{ type: 'text', text: 'hello' }],
      { providerID: 'codex', modelID: 'gpt-5.3-codex', variant: undefined },
      { codexFastMode: true }
    )
    expect(openCodeService.prompt).not.toHaveBeenCalled()
  })

  it('routes omx prompts through the OMX implementer instead of OpenCode', async () => {
    const omxImpl = createMockOmxImpl()
    const sdkManager = createMockOmxSdkManager(omxImpl)
    const dbService = {
      getAgentSdkForSession: vi.fn().mockReturnValue('omx'),
      getWorktreeByPath: vi.fn().mockReturnValue(null)
    } as any
    const mainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } } as any

    registerOpenCodeHandlers(mainWindow, sdkManager, dbService)

    const handler = handlers.get('opencode:prompt')!
    const result = await handler(mockEvent, {
      worktreePath: '/project',
      sessionId: 'hive-omx-session-1',
      parts: [{ type: 'text', text: 'hello from hive' }]
    })

    expect(result).toEqual({ success: true })
    expect(omxImpl.prompt).toHaveBeenCalledWith(
      '/project',
      'hive-omx-session-1',
      [{ type: 'text', text: 'hello from hive' }],
      undefined,
      undefined
    )
    expect(openCodeService.prompt).not.toHaveBeenCalled()
  })
})
