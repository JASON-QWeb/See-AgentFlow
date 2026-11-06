#!/bin/bash
# Inspects a built DMG without installing anything, then runs its bundled observer against fictional logs.
# Usage: scripts/verify-dmg.sh <path to dmg>
set -euo pipefail

dmg="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
mount="$work/mount"
server=""
mkdir -p "$mount" "$work/home"

cleanup() {
  [ -n "$server" ] && kill "$server" 2>/dev/null
  hdiutil detach "$mount" -quiet 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT
fail() { echo "FAIL: $1" >&2; exit 1; }

(cd "$(dirname "$dmg")" && shasum -a 256 -c "$(basename "$dmg").sha256")
hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$mount" "$dmg" > /dev/null

app="$mount/Agent Ops Screen Saver.app"
resources="$app/Contents/Resources"
runtime="$resources/runtime"

codesign --verify --deep --strict "$app"
[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIconFile' "$app/Contents/Info.plist")" = AppIcon ] || fail 'icon is not declared'
cmp -s "$resources/AppIcon.icns" "$root/macos/assets/AppIcon.icns" || fail 'bundled icon differs from the repository'
[ -f "$resources/MenuBarIconTemplate@2x.png" ] || fail 'menu bar icon is missing'
[ -d "$app/Contents/PlugIns/AgentOpsSaver.appex" ] || fail 'screen saver extension is missing'
[ -L "$mount/Applications" ] || fail 'Applications shortcut is missing'
codesign -dv "$runtime/node" 2>&1 | grep -q '^TeamIdentifier=HX7739G8FX$' || fail 'bundled Node is not the official build'

personal="$(find "$app" \( -name '*.jsonl' -o -name '*.log' -o -name '.env*' -o -name 'app-lock.json' -o -name 'preferences.json' \))"
[ -z "$personal" ] || fail "image contains personal files: $personal"
if grep -qiE 'password|recovery' "$mount/Install.txt"; then fail 'Install.txt describes a withheld feature'; fi

export HOME="$work/home" PORT=4397
while IFS= read -r line; do export "$line"; done < <("$runtime/node" "$root/scripts/ci-fixtures.mjs" "$work/logs")
(cd "$runtime" && exec ./node server/index.mjs > "$work/server.log" 2>&1) &
server=$!

for _ in $(seq 1 40); do
  curl -fs "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1 && break
  kill -0 "$server" 2>/dev/null || { cat "$work/server.log" >&2; fail 'bundled observer exited'; }
  sleep 0.25
done
curl -fs "http://127.0.0.1:$PORT/api/snapshot" | "$runtime/node" -e "
  let text = ''; process.stdin.on('data', chunk => text += chunk).on('end', () => {
    const { totalSessions, events } = JSON.parse(text);
    if (totalSessions !== 2 || !events.length) { console.error('Unexpected snapshot', totalSessions, events.length); process.exit(1); }
  });" || fail 'bundled observer did not read the logs'
curl -fs "http://127.0.0.1:$PORT/" | grep -q 'rel="icon"' || fail 'bundled dashboard did not load'

echo "PASS: $(basename "$dmg") checksum, signature, icon, contents and bundled observer"
