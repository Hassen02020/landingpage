#!/bin/bash
# Parcours fonctionnel de l'admin (faux Supabase). Voir run-fake.sh.
# seuil VIP de TEST uniquement (le vrai seuil n'est pas décidé : variable LANDING_VIP_THRESHOLD_TND)
export LANDING_VIP_THRESHOLD_TND=${LANDING_VIP_THRESHOLD_TND:-10000}
exec bash "$(dirname "$0")/run-fake.sh" tests/e2e/admin-flow.e2e.mjs
