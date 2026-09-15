#!/usr/bin/env bash
set -euo pipefail
app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
server_dir="$(cd "$app_dir/../server" && pwd)"
data_dir="$(mktemp -d)"
server_pid=''
app_pid=''
mock_pid=''
cleanup() {
  for pid in "$server_pid" "$app_pid" "$mock_pid"; do
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; fi
  done
  rm -rf "$data_dir"
}
trap cleanup EXIT
node "$app_dir/scripts/p0-mock-provider.mjs" > "$data_dir/provider.log" 2>&1 & mock_pid=$!
OPENCREW_DATA_DIR="$data_dir" OPENCREW_HOST=127.0.0.1 OPENCREW_PORT=4000 node "$server_dir/dist/index.js" > "$data_dir/server.log" 2>&1 & server_pid=$!
node "$app_dir/node_modules/vite/bin/vite.js" --host 127.0.0.1 --port 5173 --strictPort > "$data_dir/app.log" 2>&1 & app_pid=$!
ready=0
for attempt in {1..40}; do
  if curl -fsS http://127.0.0.1:5173/api/v1/auth/status > /dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then
  cat "$data_dir/server.log" "$data_dir/app.log"
  exit 1
fi
cd "$app_dir"
node scripts/p0-proxy-client.mjs
