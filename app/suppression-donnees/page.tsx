import type { Metadata } from "next"
import Link from "next/link"
import { PHONE_NUMBER, SITE_URL, WHATSAPP_NUMBER } from "@/lib/config"
import { LEGAL } from "@/lib/legal"
import { waText } from "@/lib/wa-text"

// Page d'instructions de suppression des données, demandée par Meta pour l'application (Facebook, Instagram, WhatsApp).
// Elle ne promet que ce que la politique de confidentialité dit déjà : demande par WhatsApp ou par téléphone, recours INPDP.
export const metadata: Metadata = {
  title: "Suppression de vos données — Easy2Book",
  description: "Comment demander la suppression de vos données personnelles auprès d'Easy2Book.",
  alternates: { canonical: `${SITE_URL}/suppression-donnees` },
}

const display = `${PHONE_NUMBER.slice(0, 2)} ${PHONE_NUMBER.slice(2, 5)} ${PHONE_NUMBER.slice(5)}`

export default function SuppressionDonneesPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg">Easy2Book</Link>
          <Link href="/" className="text-sm font-bold text-blue-700 hover:underline">← Retour au site</Link>
        </div>
      </header>
      <main id="contenu" className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-black mb-2">Suppression de vos données</h1>
        <p className="text-sm text-gray-600 mb-10">Dernière mise à jour : novembre 2026</p>

        <section className="mb-8">
          <p className="text-gray-700 leading-relaxed">
            {LEGAL.companyName} (« Easy2Book ») conserve les informations que vous nous confiez pour répondre à votre demande (nom, numéro de téléphone, demande de voyage ou d&apos;Omra) :
            par le formulaire du site, par WhatsApp, ou par un formulaire Facebook ou Instagram. Vous pouvez demander à tout moment la suppression de ces données.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Comment faire la demande</h2>
          <ol className="list-decimal pl-6 space-y-1 text-gray-700 leading-relaxed">
            <li>Écrivez-nous sur WhatsApp ou appelez-nous au <a className="font-bold text-blue-700 hover:underline" href={`tel:+216${PHONE_NUMBER}`}>{display}</a>.</li>
            <li>Indiquez que vous souhaitez supprimer vos données, avec le numéro de téléphone que vous nous avez communiqué, pour que nous retrouvions votre dossier.</li>
            <li>Nous vous confirmons la suppression ou l&apos;anonymisation de votre dossier.</li>
          </ol>
          <p className="mt-4">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText("Bonjour Easy2Book, je souhaite supprimer mes données personnelles."))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3"
            >
              Demander sur WhatsApp
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Ce que cela change</h2>
          <p className="text-gray-700 leading-relaxed">
            Votre dossier est supprimé ou anonymisé : nous ne pouvons plus vous recontacter à son sujet. Si vous aviez accepté le suivi publicitaire, vous pouvez aussi retirer ce choix à tout moment.
            Pour les détails (données collectées, durées de conservation, destinataires), consultez notre <Link className="font-bold text-blue-700 hover:underline" href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold mb-2">Un recours</h2>
          <p className="text-gray-700 leading-relaxed">
            Vous pouvez aussi saisir l&apos;Instance nationale de protection des données personnelles (INPDP), conformément à la loi organique tunisienne n° 2004-63.
          </p>
        </section>
      </main>
    </div>
  )
}
