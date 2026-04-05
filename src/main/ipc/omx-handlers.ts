import { ipcMain } from 'electron'
import { buildOmxStartupCommand, killOmxTmuxSession } from '../services/omx-service'
import { createLogger } from '../services/logger'

const log = createLogger({ component: 'OmxHandlers' })

export function registerOmxHandlers(): void {
  ipcMain.handle(
    'omx:buildStartupCommand',
    async (
      _event,
      {
        cwd,
        tmuxSessionName,
        launchArgs
      }: { cwd: string; tmuxSessionName: string; launchArgs?: string[] }
    ) => {
      try {
        return {
          success: true,
          command: buildOmxStartupCommand({ cwd, tmuxSessionName, launchArgs })
        }
      } catch (error) {
        log.error('IPC: omx:buildStartupCommand failed', { error, cwd, tmuxSessionName })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )

  ipcMain.handle(
    'omx:shutdownSession',
    async (_event, { tmuxSessionName }: { tmuxSessionName: string }) => {
      try {
        await killOmxTmuxSession(tmuxSessionName)
        return { success: true }
      } catch (error) {
        log.error('IPC: omx:shutdownSession failed', { error, tmuxSessionName })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )
}
