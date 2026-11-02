#!/bin/bash
# Parcours fonctionnel de l'admin (faux Supabase). Voir run-fake.sh.
exec bash "$(dirname "$0")/run-fake.sh" tests/e2e/admin-flow.e2e.mjs
