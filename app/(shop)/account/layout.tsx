import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { signOutAction } from "@/lib/actions/auth"

const NAV = [
  { label: "Overview", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "My Pets", href: "/account/pets" },
  { label: "Autoship", href: "/account/subscriptions" },
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Addresses", href: "/account/addresses" },
  { label: "Profile", href: "/account/profile" },
]

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="mb-4 truncate text-sm text-ink-500">{user?.email}</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-coral-600 hover:bg-coral-50"
            >
              Sign Out
            </button>
          </form>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  )
}
