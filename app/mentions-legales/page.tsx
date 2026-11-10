import type { Metadata } from "next"
import Link from "next/link"
import { SITE_URL } from "@/lib/config"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Mentions légales — Easy2Book",
  description: "Éditeur du site, identification de l'entreprise, directeur de publication, hébergement et propriété intellectuelle.",
  alternates: { canonical: `${SITE_URL}/mentions-legales` },
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg">{LEGAL.brand}</Link>
          <Link href="/" className="text-sm font-bold text-blue-700 hover:underline">← Retour au site</Link>
        </div>
      </header>
      <main id="contenu" className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-black mb-2">Mentions légales</h1>
        <p className="text-sm text-gray-600 mb-10">Dernière mise à jour : {LEGAL.updatedAt}</p>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Éditeur du site</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-gray-700">
            <dt className="font-bold">Raison sociale</dt>
            <dd>{LEGAL.companyName}</dd>
            <dt className="font-bold">Nom commercial</dt>
            <dd>{LEGAL.brand}</dd>
            <dt className="font-bold">Identifiant fiscal / RC</dt>
            <dd>{LEGAL.registrationId}</dd>
            <dt className="font-bold">Adresse</dt>
            <dd>{LEGAL.address}</dd>
            <dt className="font-bold">Téléphone</dt>
            <dd>
              {LEGAL.phones.map((p, i) => (
                <span key={p}>
                  {i > 0 && " / "}
                  <a className="text-blue-700 font-semibold" href={`tel:+216${p.replace(/\s/g, "")}`}>{p}</a>
                </span>
              ))}
            </dd>
          </dl>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Directeur de la publication</h2>
          <p className="text-gray-700">{LEGAL.publicationDirector}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Hébergement</h2>
          <p className="text-gray-700 leading-relaxed">
            Le site est hébergé par {LEGAL.host.name} ({LEGAL.host.country}), <a className="text-blue-700 underline" href={LEGAL.host.site} target="_blank" rel="noopener noreferrer">vercel.com</a>.
            Les données des demandes sont enregistrées dans une base {LEGAL.database.name}.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Nature des offres</h2>
          <p className="text-gray-700 leading-relaxed">
            Les prix affichés sont des tarifs « à partir de », indicatifs. Les offres, les prix, les réductions et les disponibilités sont confirmés par un conseiller {LEGAL.brand}, sur WhatsApp ou par téléphone, avant toute réservation. Aucune réservation n&apos;est engagée par la simple consultation du site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Propriété intellectuelle</h2>
          <p className="text-gray-700 leading-relaxed">
            Le nom, le logo {LEGAL.brand} et les contenus du site sont la propriété de l&apos;éditeur. Certaines photographies sont issues d&apos;Adobe Stock, sous licence. Toute reproduction sans autorisation est interdite.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold mb-2">Données personnelles</h2>
          <p className="text-gray-700 leading-relaxed">
            Le traitement de vos données est décrit dans la <Link className="text-blue-700 underline" href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>
      </main>
    </div>
  )
}
