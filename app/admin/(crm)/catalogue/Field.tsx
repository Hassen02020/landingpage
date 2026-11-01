// Champ de formulaire réutilisable (défini hors des composants : la saisie est conservée en cas d'erreur)
export function Field({ label, error, help, children, className = "" }: { label: string; error?: string; help?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-bold">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="text-xs text-red-600">{error}</span> : help ? <span className="text-xs text-gray-500">{help}</span> : null}
    </label>
  )
}

export const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
