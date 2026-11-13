#!/bin/bash
# Parcours complet du Créateur de Landing Pages (faux Supabase multi-entreprises, serveur de production local).
#   npm run build && bash tests/e2e/run-creator.sh
export LANDING_LINK_CHECK_ORIGIN=${LANDING_LINK_CHECK_ORIGIN:-http://localhost:${PORT:-3458}}
export LANDING_ADMIN_API_KEY=${LANDING_ADMIN_API_KEY:-test-admin-api-key-0123456789-abcdef-xyz}
exec bash "$(dirname "$0")/run-fake.sh" tests/e2e/creator.e2e.mjs
