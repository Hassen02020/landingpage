// Base NON configurée : erreur de service (HTTP 500), jamais un 404 ni une redirection d'erreur.
//   npm run build && bash tests/e2e/run-public.sh tests/e2e/fallback-nodb.e2e.mjs
const BASE = process.argv[2] || "http://localhost:3456"
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const head = (p) => fetch(`${BASE}${p}`, { redirect: "manual" })
for (const p of ["/c/une-categorie?utm_source=facebook", "/o/une-entreprise?utm_source=tiktok"]) {
  const r = await head(p)
  const body = await r.text()
  check(`base non configurée : ${p.split("?")[0]} → HTTP 500 (ni 404 ni redirection)`, r.status === 500 && !r.headers.get("location"), String(r.status))
  check(`  … pas la page « introuvable »`, !body.includes("n&#x27;existe pas"))
}
let r = await head("/c/omra-2027?utm_source=facebook&utm_campaign=x")
check("NON-RÉGRESSION : /c/omra-2027 redirige vers /omra sans base", r.status === 307 && (r.headers.get("location") || "").endsWith("/omra?utm_source=facebook&utm_campaign=x"), `${r.status} ${r.headers.get("location")}`)
r = await head("/omra-2027?utm_source=facebook&utm_campaign=x")
check("/omra-2027 → 307 vers /omra sans base, paramètres conservés", r.status === 307 && (r.headers.get("location") || "").endsWith("/omra?utm_source=facebook&utm_campaign=x"), `${r.status} ${r.headers.get("location")}`)
r = await head("/omra?utm_source=facebook")
check("NON-RÉGRESSION : /omra → 200 (offres intégrées)", r.status === 200, String(r.status))
r = await head("/page-qui-nexiste-pas")
check("URL inexistante → toujours 404 (pas confondue avec une panne)", r.status === 404, String(r.status))
console.log(failed ? `\n${failed} échec(s)` : "\nparcours sans base OK")
process.exit(failed ? 1 : 0)
