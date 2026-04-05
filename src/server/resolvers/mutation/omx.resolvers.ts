import type { Resolvers } from '../../__generated__/resolvers-types'
import { killOmxTmuxSession } from '../../../main/services/omx-service'

export const omxMutationResolvers: Resolvers = {
  Mutation: {
    omxShutdownSession: async (_parent, { tmuxSessionName }) => {
      try {
        await killOmxTmuxSession(tmuxSessionName)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }
}
