/** Échec de chargement : message explicite, distinct d'un état vide réel (« Aucun client » après un chargement réussi). Aucun détail technique affiché. */
export function LoadError({ what }: { what: string }) {
  return (
    <p role="alert" data-testid="load-error" className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm p-4">
      Impossible de charger {what}. Réessayez.
    </p>
  )
}
