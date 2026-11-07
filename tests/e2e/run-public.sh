#!/bin/bash
# Parcours publics (consentement, collecte, Omra) : site neuf SANS base configurée.
#   npm run build && bash tests/e2e/run-public.sh tests/e2e/consent.e2e.mjs
set -u
cd "$(dirname "$0")/../.."
SCRIPT=${1:?fichier e2e à lancer}
PORT=${PORT:-3456}
unset LANDING_SUPABASE_URL LANDING_SUPABASE_SERVICE_ROLE_KEY LANDING_SUPABASE_PUBLISHABLE_KEY META_ACCESS_TOKEN TIKTOK_ACCESS_TOKEN
for d in /proc/[0-9]*; do a=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null | cut -c1-40); case "$a" in next-server*) kill "${d#/proc/}" 2>/dev/null ;; esac; done
sleep 1
# le cache de données de Next survit aux lancements : une réponse de la sonde multi-entreprises d'un test précédent fausserait celui-ci
rm -rf .next/cache/fetch-cache
npx next start -p "$PORT" >/dev/null 2>&1 &
SITE=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/omra" && break; sleep 1; done
node "$SCRIPT" "http://localhost:$PORT"
RC=$?
kill "$SITE" 2>/dev/null
exit $RC
