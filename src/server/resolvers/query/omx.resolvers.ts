import type { Resolvers } from '../../__generated__/resolvers-types'
import { buildOmxStartupCommand } from '../../../main/services/omx-service'

export const omxQueryResolvers: Resolvers = {
  Query: {
    omxBuildStartupCommand: async (_parent, { cwd, tmuxSessionName, launchArgs }) => {
      try {
        return {
          success: true,
          command: buildOmxStartupCommand({
            cwd,
            tmuxSessionName,
            launchArgs: launchArgs ?? undefined
          })
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }
}
