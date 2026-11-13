"use client"

import { useState } from "react"

/** Aperçu RÉEL : la vraie page publique (même composant) dans un cadre mobile ou ordinateur. Boutons et formulaire y sont désactivés. */
export function PreviewPanel({ id }: { id: string }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile")
  const k = 0.62
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["mobile", "desktop"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`px-4 py-2 rounded-xl text-sm font-bold ${device === d ? "bg-violet-700 text-white" : "bg-white border hover:bg-gray-50"}`}>
            {d === "mobile" ? "📱 Mobile" : "🖥️ Ordinateur"}
          </button>
        ))}
      </div>
      <div className="bg-gray-200 rounded-2xl p-4 overflow-auto flex justify-center">
        {device === "mobile" ? (
          <iframe title="Aperçu mobile" src={`/admin/createur-rendu/${id}`} data-device="mobile" style={{ width: 390, height: 760 }} className="bg-white rounded-3xl border-8 border-gray-800" />
        ) : (
          <div style={{ width: 1280 * k, height: 820 * k }}>
            <iframe title="Aperçu ordinateur" src={`/admin/createur-rendu/${id}`} data-device="desktop" style={{ width: 1280, height: 820, transform: `scale(${k})`, transformOrigin: "top left" }} className="bg-white rounded-lg border" />
          </div>
        )}
      </div>
    </div>
  )
}
