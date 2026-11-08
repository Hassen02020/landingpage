"use client"

// Cadre de l'espace équipe : menu latéral groupé (bureau), barre haute + tiroir (mobile).
import { can, ROLE_LABELS, type OrgRole, type Permission } from "@/lib/permissions"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { logoutAction } from "../../actions"

type IconName = "leads" | "pipeline" | "clock" | "plus" | "chart" | "calc" | "box" | "ticket" | "shield" | "plug" | "link" | "team" | "chat" | "download" | "user"

const ICONS: Record<IconName, React.ReactNode> = {
  leads: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.5a3 3 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 5.6" /></>),
  pipeline: (<><rect x="3" y="4" width="5" height="16" rx="1.2" /><rect x="9.5" y="4" width="5" height="10" rx="1.2" /><rect x="16" y="4" width="5" height="13" rx="1.2" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>),
  plus: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  calc: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>),
  box: (<><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>),
  ticket: (<><path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" /><path d="M14 6v12" strokeDasharray="2 2" /></>),
  shield: (<><path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  plug: (<><path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4" /></>),
  team: (<><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M2.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2M15 14.9c3 0 6.5 1.2 6.5 4.6" /></>),
  chat: (<><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M8 10h8M8 13h5" /></>),
  download: (<><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></>),
  user: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" /></>),
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {ICONS[name]}
    </svg>
  )
}

interface Item {
  href: string
  label: string
  icon: IconName
  permission?: Permission // absent : visible par tous les rôles
  plain?: boolean // lien « normal » (téléchargement) au lieu de <Link>
  match?: (path: string, params: URLSearchParams) => boolean
}
interface Group {
  title: string
  items: Item[]
}

const GROUPS: Group[] = [
  {
    title: "Leads",
    items: [
      { href: "/admin", label: "Leads", icon: "leads", match: (p, q) => (p === "/admin" && q.get("followUp") !== "due") || (p.startsWith("/admin/leads/") && p !== "/admin/leads/new") },
      { href: "/admin/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/admin/clients", label: "Clients", icon: "team" },
      { href: "/admin?followUp=due", label: "Relances", icon: "clock", match: (p, q) => p === "/admin" && q.get("followUp") === "due" },
      { href: "/admin/leads/new", label: "Nouveau lead", icon: "plus" },
    ],
  },
  {
    title: "Analyse",
    items: [
      { href: "/admin/stats", label: "Statistiques", icon: "chart" },
      { href: "/admin/segments", label: "Segments", icon: "team" },
      { href: "/admin/liens", label: "Liens de campagne", icon: "link" },
      { href: "/admin/calculateur", label: "Calculateur", icon: "calc" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/catalogue", label: "Offres et catégories", icon: "box", permission: "catalog.manage" },
      { href: "/admin/promos", label: "Codes promo", icon: "ticket", permission: "promos.manage" },
    ],
  },
  {
    title: "Réglages",
    items: [
      { href: "/admin/integrations", label: "Intégrations", icon: "plug", permission: "social.connect" },
      { href: "/admin/formulaire", label: "Formulaire", icon: "chat", permission: "site.manage" },
      { href: "/admin/protection", label: "Protection", icon: "shield", permission: "protection.manage" },
      { href: "/admin/equipe", label: "Équipe", icon: "team", permission: "employees.view" },
      { href: "/admin/modeles", label: "Modèles WhatsApp", icon: "chat", permission: "templates.manage" },
      { href: "/admin/export", label: "Export CSV", icon: "download", plain: true, permission: "data.export" },
    ],
  },
]

function Nav({ role, onNavigate }: { role: OrgRole; onNavigate: () => void }) {
  const path = usePathname() || "/admin"
  const params = useSearchParams()
  const isActive = (it: Item) => (it.match ? it.match(path, params) : path === it.href || path.startsWith(`${it.href}/`))
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Navigation principale">
      {GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !it.permission || can(role, it.permission)) })).filter((g) => g.items.length > 0).map((g) => (
        <div key={g.title}>
          <div className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-300/70">{g.title}</div>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(it)
              const cls = `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${active ? "bg-white text-violet-900 shadow-sm" : "text-violet-100 hover:bg-white/10"}`
              return (
                <li key={it.href}>
                  {it.plain ? (
                    <a href={it.href} className={cls}><Icon name={it.icon} />{it.label}</a>
                  ) : (
                    <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls}><Icon name={it.icon} />{it.label}</Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AdminShell({ email, name, role, orgName, orgSlug, children }: { email: string; name: string | null; role: OrgRole; orgName: string | null; orgSlug: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const path = usePathname()
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])
  const shown = name || email.split("@")[0]
  // image de marque : le nom de L'ENTREPRISE connectée ; le logo d'Easy2Book n'est montré qu'à l'organisation de la plateforme
  const brand = orgName || "Easy2Book"
  const isPlatform = !orgSlug || orgSlug === "easy2book"

  const Sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-violet-950 via-violet-900 to-violet-950 text-white">
      <Link href="/admin" className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        {isPlatform ? (
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-full bg-white" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black uppercase text-violet-900">{brand.charAt(0)}</span>
        )}
        <div className="min-w-0">
          <div className="truncate font-black leading-tight">{brand}</div>
          <div className="text-[11px] text-violet-300">Espace équipe</div>
        </div>
      </Link>
      <Suspense fallback={<div className="flex-1" />}>
        <Nav role={role} onNavigate={() => setOpen(false)} />
      </Suspense>
      <div className="border-t border-white/10 p-3">
        <Link href="/admin/compte" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/10">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500 text-sm font-black uppercase">{shown.charAt(0)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{shown}</span>
            <span className="block truncate text-[11px] text-violet-300">{ROLE_LABELS[role]} · Mon compte</span>
          </span>
        </Link>
        <form action={logoutAction} className="mt-2">
          <button className="w-full rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-white/10">Déconnexion</button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* bureau */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-64">{Sidebar}</aside>

      {/* mobile : barre haute + tiroir */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="rounded-lg border p-2">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <Link href="/admin" className="flex items-center gap-2 font-black">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" /> Easy2Book
        </Link>
        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-xs font-black uppercase text-white">{shown.charAt(0)}</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">{Sidebar}</div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
