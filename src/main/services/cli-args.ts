export function getCliArgs(
  argv: string[] = process.argv,
  options: { isPackaged?: boolean } = {}
): string[] {
  return argv.slice(options.isPackaged ? 1 : 2)
}

export function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1 || index === args.length - 1) return undefined
  return args[index + 1]
}

export function getNumericFlagValue(
  args: string[],
  flag: string,
  options: { min?: number; max?: number } = {}
): number | undefined {
  const value = getFlagValue(args, flag)
  if (!value || !/^\d+$/.test(value)) return undefined
  const parsed = parseInt(value, 10)
  if (options.min != null && parsed < options.min) return undefined
  if (options.max != null && parsed > options.max) return undefined
  return parsed
}
