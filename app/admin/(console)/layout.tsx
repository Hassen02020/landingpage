import Link from "next/link"
import { signOutAction } from "@/lib/actions/auth"

const NAV = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Brands", href: "/admin/brands" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Providers", href: "/admin/providers" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Pets", href: "/admin/pets" },
  { label: "Subscriptions", href: "/admin/subscriptions" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Settings", href: "/admin/settings" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-100 bg-white p-4 lg:flex">
        <Link href="/admin/dashboard" className="mb-6 px-2 font-display text-lg font-bold text-forest">
          PETORA Admin
        </Link>
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
        </nav>
        <form action={signOutAction} className="mt-auto pt-4">
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-coral-600 hover:bg-coral-50">
            Sign Out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
