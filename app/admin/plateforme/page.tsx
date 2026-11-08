import { listOrganizations } from "@/lib/server/platform"
import { setStatusAction } from "./actions"
import { CreateOrganization } from "./Forms"

export const dynamic = "force-dynamic"

export default async function PlatformPage() {
  const orgs = await listOrganizations().catch(() => null)
  const th = "p-3 text-left text-gray-500 font-semibold"
  return (
    <>
      <div>
        <h1 className="text-2xl font-black">Entreprises</h1>
        <p className="text-sm text-gray-600">Le Super Admin crée les entreprises et leur premier administrateur. Il ne voit aucun lead : ni ici, ni ailleurs.</p>
      </div>
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="font-black">Nouvelle entreprise</h2>
        <p className="text-sm text-gray-600">Le premier administrateur reçoit une invitation par e-mail et choisit lui-même son mot de passe. Vous ne le voyez jamais.</p>
        <CreateOrganization />
      </section>
      <section className="overflow-x-auto rounded-2xl border bg-white">
        {orgs === null ? (
          <p className="p-5 text-sm text-red-700">Lecture impossible (migration 0008 appliquée ?).</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{["Entreprise", "Statut", "Membres", "Administrateurs", "Actions"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3"><div className="font-bold">{o.name}</div><div className="text-xs text-gray-500" dir="ltr">{o.slug}{o.sector ? ` · ${o.sector}` : ""}</div></td>
                  <td className="p-3">{o.status === "active" ? "Active" : "Suspendue"}</td>
                  <td className="p-3">{o.members}</td>
                  <td className="p-3">{o.admins}</td>
                  <td className="p-3">
                    {o.slug === "easy2book" ? (
                      <span className="text-xs text-gray-500">Plateforme (protégée)</span>
                    ) : (
                      <form action={setStatusAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="status" value={o.status === "active" ? "suspended" : "active"} />
                        <button className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">{o.status === "active" ? "Suspendre" : "Réactiver"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
