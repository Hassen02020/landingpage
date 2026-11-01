"use client"

// Case « tout sélectionner » pour les actions groupées de la liste des leads.
export function SelectAll({ form }: { form: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`form#${form} input[name="ids"]`).forEach((c) => (c.checked = e.currentTarget.checked))
      }}
    />
  )
}
