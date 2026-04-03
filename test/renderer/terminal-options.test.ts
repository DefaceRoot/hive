import { describe, expect, test } from 'vitest'
import {
  getTerminalLabel,
  getTerminalOptionsForPlatform
} from '../../src/renderer/src/lib/terminal-options'

describe('terminal options', () => {
  test('exposes Linux terminals that detection supports', () => {
    expect(getTerminalOptionsForPlatform('linux')).toEqual(
      expect.arrayContaining([
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
      ])
    )
  })

  test('returns a friendly label for Linux terminals in quick actions', () => {
    expect(getTerminalLabel('gnome-terminal')).toBe('GNOME Terminal')
    expect(getTerminalLabel('wezterm')).toBe('WezTerm')
    expect(getTerminalLabel('foot')).toBe('foot')
  })
})
