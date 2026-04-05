import { graphqlQuery } from '../client'

export function createOmxOpsAdapter(): Window['omxOps'] {
  return {
    async buildStartupCommand({
      cwd,
      tmuxSessionName,
      launchArgs
    }: {
      cwd: string
      tmuxSessionName: string
      launchArgs?: string[]
    }): Promise<{ success: boolean; command?: string; error?: string }> {
      const data = await graphqlQuery<{
        omxBuildStartupCommand: { success: boolean; command?: string; error?: string }
      }>(
        `query ($cwd: String!, $tmuxSessionName: String!, $launchArgs: [String!]) {
          omxBuildStartupCommand(
            cwd: $cwd
            tmuxSessionName: $tmuxSessionName
            launchArgs: $launchArgs
          ) {
            success command error
          }
        }`,
        { cwd, tmuxSessionName, launchArgs }
      )

      return data.omxBuildStartupCommand
    },

    async shutdownSession(tmuxSessionName: string): Promise<{ success: boolean; error?: string }> {
      const data = await graphqlQuery<{
        omxShutdownSession: { success: boolean; error?: string }
      }>(
        `mutation ($tmuxSessionName: String!) {
          omxShutdownSession(tmuxSessionName: $tmuxSessionName) { success error }
        }`,
        { tmuxSessionName }
      )

      return data.omxShutdownSession
    }
  }
}
