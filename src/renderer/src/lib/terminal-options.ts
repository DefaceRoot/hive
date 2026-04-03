import type { TerminalOption } from '@/stores/useSettingsStore'

export const MAC_TERMINAL_OPTIONS: Array<{ id: TerminalOption; label: string }> = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'iterm', label: 'iTerm2' },
  { id: 'warp', label: 'Warp' },
  { id: 'alacritty', label: 'Alacritty' },
  { id: 'kitty', label: 'kitty' },
  { id: 'ghostty', label: 'Ghostty' },
  { id: 'custom', label: 'Custom Command' }
]

export const WINDOWS_TERMINAL_OPTIONS: Array<{ id: TerminalOption; label: string }> = [
  { id: 'terminal', label: 'Windows Terminal' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'cmd', label: 'Command Prompt' },
  { id: 'custom', label: 'Custom Command' }
]

export const LINUX_TERMINAL_OPTIONS: Array<{ id: TerminalOption; label: string }> = [
  { id: 'terminal', label: 'Default Terminal' },
  { id: 'gnome-terminal', label: 'GNOME Terminal' },
  { id: 'konsole', label: 'Konsole' },
  { id: 'xfce4-terminal', label: 'Xfce Terminal' },
  { id: 'alacritty', label: 'Alacritty' },
  { id: 'kitty', label: 'kitty' },
  { id: 'ghostty', label: 'Ghostty' },
  { id: 'wezterm', label: 'WezTerm' },
  { id: 'foot', label: 'foot' },
  { id: 'custom', label: 'Custom Command' }
]

export function getTerminalOptionsForPlatform(
  platform: 'darwin' | 'win32' | 'linux'
): Array<{ id: TerminalOption; label: string }> {
  if (platform === 'win32') return WINDOWS_TERMINAL_OPTIONS
  if (platform === 'darwin') return MAC_TERMINAL_OPTIONS
  return LINUX_TERMINAL_OPTIONS
}

export function getTerminalLabel(option: TerminalOption): string {
  const labels: Record<TerminalOption, string> = {
    terminal: 'Terminal',
    'gnome-terminal': 'GNOME Terminal',
    konsole: 'Konsole',
    'xfce4-terminal': 'Xfce Terminal',
    iterm: 'iTerm',
    warp: 'Warp',
    alacritty: 'Alacritty',
    kitty: 'Kitty',
    ghostty: 'Ghostty',
    wezterm: 'WezTerm',
    foot: 'foot',
    powershell: 'PowerShell',
    cmd: 'CMD',
    custom: 'Terminal'
  }

  return labels[option]
}
