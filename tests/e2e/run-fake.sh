#!/bin/bash
# Lance un parcours e2e contre un site neuf branché sur le FAUX Supabase (aucune donnée réelle, aucun appel Meta / TikTok).
#   npm run build && bash tests/e2e/run-fake.sh tests/e2e/social.e2e.mjs
set -u
cd "$(dirname "$0")/../.."
SCRIPT=${1:?fichier e2e à lancer}
PORT=${PORT:-3458}
export LANDING_SUPABASE_URL=http://127.0.0.1:54321 LANDING_SUPABASE_SERVICE_ROLE_KEY=test-service-role-key-0123456789 LANDING_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test
unset META_ACCESS_TOKEN TIKTOK_ACCESS_TOKEN
for d in /proc/[0-9]*; do a=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null | cut -c1-40); case "$a" in next-server*) kill "${d#/proc/}" 2>/dev/null ;; esac; done
sleep 1
npx next start -p "$PORT" >/dev/null 2>&1 &
SITE=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/admin/login" && break; sleep 1; done
node "$SCRIPT" "http://localhost:$PORT"
RC=$?
kill "$SITE" 2>/dev/null
exit $RC
