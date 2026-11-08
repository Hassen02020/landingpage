import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { listTeam } from "@/lib/server/team"
import { updateMemberAction } from "../../team-actions"
import { AddMember, ResetPassword } from "./Forms"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const me = await currentStaff()
  if (!me || !can(me.orgRole, "employees.view")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const canManage = can(me?.orgRole, "employees.manage")
  const team = await listTeam().catch(() => [])
  const th = "p-3 text-left text-gray-500 font-semibold"
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Équipe</h1>
        <p className="text-sm text-gray-600">Employés : leads, pipeline, statistiques (ils modifient leurs leads et les leads non affectés). Managers : en plus l&apos;affectation des leads et la vue de l&apos;équipe. Administrateurs : en plus catalogue, promos, protection, intégrations, équipe, export.</p>
      </div>
      {canManage && <section className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="font-black">Ajouter un membre</h2>
        <p className="text-sm text-gray-600">Un mot de passe provisoire s&apos;affiche une seule fois : transmettez-le au membre, qui le change dans « Mon compte ».</p>
        <AddMember />
      </section>}
      <section className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{["Membre", "Rôle", "Accès", "Actions"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {team.map((m) => {
              const self = m.user_id === me.userId
              return (
                <tr key={m.user_id} className={`border-t ${m.active ? "" : "text-gray-400"}`}>
                  <td className="p-3"><div className="font-bold">{m.full_name || m.email}</div><div className="text-xs text-gray-500" dir="ltr">{m.email}</div></td>
                  <td className="p-3">
                    <form action={updateMemberAction} className="flex gap-1">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input type="hidden" name="what" value="role" />
                      <select name="role" defaultValue={m.role} disabled={self || !canManage} className="border rounded-lg px-2 py-1">
                        <option value="agent">Employé</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Administrateur</option>
                      </select>
                      {!self && canManage && <button className="text-xs border rounded-lg px-2">OK</button>}
                    </form>
                  </td>
                  <td className="p-3">{m.active ? "Actif" : "Désactivé"}</td>
                  <td className="p-3 flex flex-wrap gap-2 items-start">
                    {!self && canManage && (
                      <form action={updateMemberAction}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <input type="hidden" name="what" value="active" />
                        <input type="hidden" name="active" value={String(!m.active)} />
                        <button className={`text-xs border rounded-lg px-2 py-1 ${m.active ? "text-red-700" : "text-green-700"}`}>{m.active ? "Désactiver l'accès" : "Réactiver"}</button>
                      </form>
                    )}
                    {!self && canManage && m.active && <ResetPassword userId={m.user_id} />}
                    {self && <span className="text-xs text-gray-500">vous</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-gray-500">Il reste toujours au moins un administrateur actif (règle en base). Un membre désactivé ne peut plus se connecter à /admin ; son historique est conservé.</p>
    </div>
  )
}
