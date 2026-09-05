import Link from "next/link"

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Dog Food", href: "/category/dog-food" },
      { label: "Cat Food", href: "/category/cat-food" },
      { label: "Treats", href: "/category/treats" },
      { label: "Toys", href: "/category/toys" },
      { label: "Deals", href: "/deals" },
    ],
  },
  {
    title: "Petora",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Autoship", href: "/subscribe" },
      { label: "Blog", href: "/blog" },
      { label: "Brands", href: "/brands" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Shipping & Returns", href: "/help/shipping" },
      { label: "Track Order", href: "/account/orders" },
      { label: "Contact Us", href: "/help/contact" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-100 bg-forest-900 text-white">
      <div className="container grid grid-cols-2 gap-8 py-12 md:grid-cols-5">
        <div className="col-span-2">
          <span className="font-display text-2xl font-bold">PETORA</span>
          <p className="mt-3 max-w-xs text-sm text-ink-200">
            Better care. Happier pets. Premium food, treats and everyday essentials for the pets you love.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-200 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-6">
        <div className="container flex flex-col items-center justify-between gap-3 text-xs text-ink-300 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} PETORA. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/legal/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/legal/terms" className="hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
