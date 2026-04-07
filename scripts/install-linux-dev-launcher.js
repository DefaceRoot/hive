#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const path = require('path')

function resolveDataHome() {
  if (process.env.XDG_DATA_HOME) {
    return process.env.XDG_DATA_HOME
  }

  return path.join(os.homedir(), '.local', 'share')
}

function buildDesktopEntry({ repoRoot, launcherPath, iconPath }) {
  return [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    'Name=Hive',
    'Comment=Launch Hive from the current repo checkout',
    `Exec=${launcherPath}`,
    `TryExec=${launcherPath}`,
    `Icon=${iconPath}`,
    'Terminal=false',
    'Categories=Development;Utility;',
    'StartupNotify=true',
    'StartupWMClass=Hive',
    'Keywords=git;worktree;ai;coding;developer;',
    `X-Hive-Repo=${repoRoot}`,
    ''
  ].join('\n')
}

function installDesktopEntry() {
  const repoRoot = path.resolve(__dirname, '..')
  const launcherPath = path.join(repoRoot, 'scripts', 'launch-local.sh')
  const iconPath = path.join(repoRoot, 'resources', 'icon.png')
  const applicationsDir = path.join(resolveDataHome(), 'applications')
  const desktopFilePath = path.join(applicationsDir, 'Hive.desktop')

  fs.mkdirSync(applicationsDir, { recursive: true })
  fs.chmodSync(launcherPath, 0o755)

  const desktopEntry = buildDesktopEntry({
    repoRoot,
    launcherPath,
    iconPath
  })

  fs.writeFileSync(desktopFilePath, desktopEntry, 'utf8')

  console.log(`Installed Hive desktop launcher at ${desktopFilePath}`)
  console.log(`Launcher target: ${launcherPath}`)
}

if (require.main === module) {
  installDesktopEntry()
}

module.exports = {
  buildDesktopEntry,
  installDesktopEntry
}
