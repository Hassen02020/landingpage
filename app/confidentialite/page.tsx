import type { Metadata } from "next"
import Link from "next/link"
import { PHONE_NUMBER, SITE_URL } from "@/lib/config"

export const metadata: Metadata = {
  title: "Politique de confidentialité — Easy2Book",
  description: "Données personnelles collectées par Easy2Book, finalités, durées de conservation et vos droits.",
  alternates: { canonical: `${SITE_URL}/confidentialite` },
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-lg">Easy2Book</Link>
          <Link href="/" className="text-sm font-bold text-blue-700 hover:underline">← Retour au site</Link>
        </div>
      </header>
      <main id="contenu" className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-black mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-gray-600 mb-10">Dernière mise à jour : novembre 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Qui traite vos données ?</h2>
          <p className="text-gray-700 leading-relaxed">Easy2Book, agence de voyage en Tunisie, traite les données que vous nous confiez lorsque vous demandez un devis ou une réservation sur ce site. Contact : <a className="font-bold text-blue-700" href={`tel:+216${PHONE_NUMBER}`}>98 140 514</a> ou WhatsApp.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Données collectées</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-700">
            <li>Nom et numéro de téléphone (obligatoires pour être recontacté).</li>
            <li>Offre demandée (voyage organisé, Omra, hôtel) et, selon le formulaire, les informations facultatives que vous ajoutez (message, e-mail, nombre de voyageurs, budget).</li>
            <li>Vos choix de consentement : être recontacté (obligatoire pour envoyer la demande), recevoir nos offres (facultatif), mesure publicitaire (facultatif).</li>
            <li>Si vous acceptez le suivi publicitaire : origine de la visite (paramètres de campagne) et événements de navigation.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">À quoi servent-elles ?</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-700">
            <li>Répondre à votre demande et vous envoyer un devis, par WhatsApp ou par téléphone.</li>
            <li>Suivre et traiter votre demande en interne (gestion commerciale).</li>
            <li>Vous envoyer nos offres, uniquement si vous l&apos;avez accepté.</li>
            <li>Mesurer l&apos;efficacité de nos publicités sur Meta (Facebook, Instagram) et TikTok, uniquement si vous l&apos;avez accepté. Sans votre accord, ces outils ne sont pas chargés.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Durées de conservation</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-700">
            <li>Demandes sans réservation : anonymisées après 24 mois d&apos;inactivité.</li>
            <li>Clients ayant réservé : anonymisées après 36 mois.</li>
            <li>Identifiant technique de visiteur : supprimé après 90 jours.</li>
            <li>Événements de navigation : supprimés après 13 mois.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Qui y a accès ?</h2>
          <p className="text-gray-700 leading-relaxed">L&apos;équipe Easy2Book habilitée. Nos prestataires techniques hébergent et traitent les données pour notre compte (hébergement du site et base de données). Si vous acceptez le suivi publicitaire, Meta et TikTok reçoivent les événements de mesure. Nous ne vendons pas vos données.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold mb-2">Vos droits</h2>
          <p className="text-gray-700 leading-relaxed">Conformément à la loi organique tunisienne n° 2004-63 sur la protection des données à caractère personnel, vous pouvez demander l&apos;accès à vos données, leur rectification ou leur suppression, et retirer votre consentement à tout moment, en nous écrivant sur WhatsApp ou en nous appelant au 98 140 514. Vous pouvez aussi saisir l&apos;Instance nationale de protection des données personnelles (INPDP).</p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold mb-2">Cookies et mesure</h2>
          <p className="text-gray-700 leading-relaxed">Le bandeau en bas de page vous permet d&apos;accepter ou de refuser le suivi publicitaire. Votre choix est mémorisé sur votre appareil ; vous pouvez le modifier en effaçant les données du site dans votre navigateur.</p>
        </section>
      </main>
    </div>
  )
}
