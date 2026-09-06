import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Pets" }

export default async function AdminPetsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("pets")
    .select("id, name, species, breed, weight_lbs, life_stage, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200)

  const pets = (data as any[]) ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Pets</h1>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Species</th>
              <th className="px-4 py-3">Breed</th>
              <th className="px-4 py-3">Life Stage</th>
              <th className="px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody>
            {pets.map((pet) => (
              <tr key={pet.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink">{pet.name}</td>
                <td className="px-4 py-3 capitalize text-ink-600">{pet.species}</td>
                <td className="px-4 py-3 text-ink-600">{pet.breed ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">{pet.life_stage?.replace("_", "/") ?? "—"}</td>
                <td className="px-4 py-3 text-ink-600">{pet.profiles?.full_name ?? pet.profiles?.email}</td>
              </tr>
            ))}
            {pets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  No pets registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
