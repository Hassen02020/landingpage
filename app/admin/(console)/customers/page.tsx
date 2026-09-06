import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Customers" }

export default async function AdminCustomersPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(200)

  const customers = data ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Customers</h1>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-forest hover:underline">
                    {c.full_name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-600">{c.email}</td>
                <td className="px-4 py-3 text-ink-600">{new Date(c.created_at).toLocaleDateString("en-US")}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-500">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
