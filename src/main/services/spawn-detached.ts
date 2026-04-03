import { spawn, type SpawnOptions } from 'child_process'

export function spawnDetached(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      ...options
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
