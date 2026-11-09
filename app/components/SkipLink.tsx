// Lien d'évitement : premier élément focalisable de la page, visible seulement au clavier (accessibilité).
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#contenu"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-gray-900 focus:shadow-2xl"
    >
      {label}
    </a>
  )
}
