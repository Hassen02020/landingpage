#!/bin/bash
# Parcours fonctionnel de l'admin contre un FAUX Supabase (aucune donnée réelle).
# Redémarre un site neuf : la limite de 5 connexions / 15 min par e-mail est en mémoire du serveur.
#   npm run build && bash tests/e2e/run-admin.sh
set -u
cd "$(dirname "$0")/../.."
PORT=${PORT:-3458}
export LANDING_SUPABASE_URL=http://127.0.0.1:54321 LANDING_SUPABASE_SERVICE_ROLE_KEY=test-service-role-key-0123456789 LANDING_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test
# arrêter un éventuel ancien serveur de ce port
for d in /proc/[0-9]*; do a=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null | cut -c1-40); case "$a" in next-server*) kill "${d#/proc/}" 2>/dev/null ;; esac; done
sleep 1
npx next start -p "$PORT" >/dev/null 2>&1 &
SITE=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/admin/login" && break; sleep 1; done
node tests/e2e/admin-flow.e2e.mjs "http://localhost:$PORT"
RC=$?
kill "$SITE" 2>/dev/null
exit $RC
