#!/bin/bash
# Deux entreprises dans la même base (faux Supabase) : preuve d'isolation de bout en bout.
#   npm run build && bash tests/e2e/run-multi.sh
export LANDING_ADMIN_API_KEY=${LANDING_ADMIN_API_KEY:-test-admin-api-key-0123456789-abcdef-xyz}
exec bash "$(dirname "$0")/run-fake.sh" tests/e2e/multi-tenant.e2e.mjs
