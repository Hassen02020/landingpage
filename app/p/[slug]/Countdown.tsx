"use client"

import { useEffect, useState } from "react"

const UNITS = {
  fr: { title: "L'offre se termine dans", d: "jours", h: "heures", m: "min", s: "sec", until: "Offre valable jusqu'au" },
  ar: { title: "ينتهي العرض بعد", d: "يوم", h: "ساعة", m: "دقيقة", s: "ثانية", until: "عرض صالح لـ" },
}
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
const MONTHS_AR = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]

/** Fin du jour de Tunis (UTC+1) pour une date AAAA-MM-JJ. */
export const deadlineTime = (day: string): number => Date.parse(`${day}T23:59:59+01:00`)

/** Compte à rebours jusqu'à la date limite choisie par l'équipe. N'affiche RIEN côté serveur (évite tout décalage) et disparaît une fois la date passée : il ne modifie jamais les offres. */
export function Countdown({ deadline, lang, className = "" }: { deadline: string; lang: "fr" | "ar"; className?: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const end = deadlineTime(deadline)
  if (now === null || Number.isNaN(end) || end <= now) return null
  const left = Math.floor((end - now) / 1000)
  const parts = [Math.floor(left / 86400), Math.floor((left % 86400) / 3600), Math.floor((left % 3600) / 60), left % 60]
  const u = UNITS[lang]
  const labels = [u.d, u.h, u.m, u.s]
  const [y, m, d] = deadline.split("-").map(Number)
  const dateText = lang === "ar" ? `${d} ${MONTHS_AR[m - 1]} ${y}` : `${d} ${MONTHS_FR[m - 1]} ${y}`
  return (
    <div className={`bg-gray-900 text-white ${className}`} data-testid="countdown" role="timer" aria-live="off">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
        <span className="font-bold">{u.title}</span>
        <span className="flex gap-3" dir="ltr">
          {parts.map((v, i) => (
            <span key={i} className="min-w-[3.2rem]"><span className="block text-2xl font-black tabular-nums">{String(v).padStart(2, "0")}</span><span className="block text-[11px] text-white/70">{labels[i]}</span></span>
          ))}
        </span>
        <span className="text-sm text-white/80">{u.until} {dateText}</span>
      </div>
    </div>
  )
}
