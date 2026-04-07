#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log_dir="${XDG_CACHE_HOME:-$HOME/.cache}/hive"
mkdir -p "$log_dir"
log_file="$log_dir/local-launcher.log"

notify_failure() {
  local message="$1"
  echo "$message" >&2

  if command -v notify-send >/dev/null 2>&1; then
    notify-send "Hive launch failed" "$message" || true
  fi
}

require_file() {
  local file_path="$1"
  local help_message="$2"

  if [[ -e "$file_path" ]]; then
    return 0
  fi

  notify_failure "$help_message"
  exit 1
}

electron_bin="$ROOT_DIR/node_modules/.bin/electron"
require_file "$electron_bin" "Missing local Electron binary at $electron_bin. Run npm install in $ROOT_DIR first."

watch_paths=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/src"
)

for candidate in \
  "$ROOT_DIR/electron.vite.config.ts" \
  "$ROOT_DIR/electron.vite.config.js" \
  "$ROOT_DIR/vite.config.web.ts" \
  "$ROOT_DIR/vite.config.web.js"; do
  if [[ -e "$candidate" ]]; then
    watch_paths+=("$candidate")
  fi
done

main_bundle="$ROOT_DIR/out/main/index.js"
preload_bundle="$ROOT_DIR/out/preload/index.js"
web_bundle="$ROOT_DIR/out/web/index.html"

needs_build=0

if [[ ! -f "$main_bundle" || ! -f "$preload_bundle" || ! -f "$web_bundle" ]]; then
  needs_build=1
else
  if find "${watch_paths[@]}" -type f -newer "$main_bundle" -print -quit | grep -q .; then
    needs_build=1
  elif find "${watch_paths[@]}" -type f -newer "$web_bundle" -print -quit | grep -q .; then
    needs_build=1
  fi
fi

if [[ "$needs_build" -eq 1 ]]; then
  {
    echo "[$(date --iso-8601=seconds)] Rebuilding Hive local launcher artifacts"
    npm run build
    npm run build:web
    rm -rf "$ROOT_DIR/out/web"
    cp -r "$ROOT_DIR/dist/web" "$ROOT_DIR/out/web"
  } >>"$log_file" 2>&1 || {
    notify_failure "Could not rebuild Hive from $ROOT_DIR. See $log_file for details."
    exit 1
  }
fi

exec "$electron_bin" "$main_bundle" "$@"
