import { describe, expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('linux packaging config', () => {
  test('packages GraphQL schema files for packaged headless mode', () => {
    const builderConfig = readFileSync(join(process.cwd(), 'electron-builder.yml'), 'utf8')

    expect(builderConfig).toContain('- src/server/schema/**/*')
    expect(builderConfig).toContain('maintainer: morapelker')
  })

  test('routes Linux packaging through the compatibility build script', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

    expect(packageJson.scripts['build:linux']).toBe('bash scripts/build-linux.sh')
  })
})
