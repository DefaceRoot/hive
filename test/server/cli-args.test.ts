import { describe, expect, test } from 'vitest'
import { getCliArgs, getFlagValue, getNumericFlagValue } from '../../src/main/services/cli-args'

describe('cli arg parsing', () => {
  test('uses Electron dev-style argv when not packaged', () => {
    expect(getCliArgs(['/usr/bin/node', '/app/out/main/index.js', '--headless'], { isPackaged: false })).toEqual([
      '--headless'
    ])
  })

  test('uses packaged argv starting at index 1', () => {
    expect(getCliArgs(['/opt/Hive/hive', '--headless', '--port', '43123'], { isPackaged: true })).toEqual([
      '--headless',
      '--port',
      '43123'
    ])
  })

  test('reads flag values safely', () => {
    expect(getFlagValue(['--headless', '--port', '43123'], '--port')).toBe('43123')
    expect(getFlagValue(['--headless'], '--port')).toBeUndefined()
  })

  test('validates numeric flags against optional bounds', () => {
    expect(getNumericFlagValue(['--port', '43123'], '--port', { min: 1, max: 65535 })).toBe(
      43123
    )
    expect(getNumericFlagValue(['--port', '0'], '--port', { min: 1, max: 65535 })).toBeUndefined()
    expect(getNumericFlagValue(['--port', '70000'], '--port', { min: 1, max: 65535 })).toBeUndefined()
  })
})
