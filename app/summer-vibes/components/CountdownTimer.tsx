"use client"

import { useState, useEffect } from "react"

// « Promo du mois » : le compte à rebours vise TOUJOURS la fin du mois en cours (heure de Tunis, UTC+1 sans changement d'heure),
// jamais une date figée qui finirait par afficher des zéros.
export function endOfMonthTunis(now = new Date()): number {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit" }).format(now).split("-").map(Number)
  return Date.UTC(y, m, 1, 0, 0, 0) - 3_600_000 - 1000 // 1er du mois suivant 00:00 à Tunis, moins 1 seconde
}

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = endOfMonthTunis(now) - now.getTime()

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      return { days, hours, minutes, seconds }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex justify-center gap-3">
      {[
        { value: String(timeLeft.days).padStart(2, '0'), label: "Jours" },
        { value: String(timeLeft.hours).padStart(2, '0'), label: "Heures" },
        { value: String(timeLeft.minutes).padStart(2, '0'), label: "Minutes" },
        { value: String(timeLeft.seconds).padStart(2, '0'), label: "Secondes" },
      ].map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center px-3 py-2 rounded-xl"
          style={{ backgroundColor: "#fff", border: "2px solid #f59e0b" }}
        >
          <span className="text-xl font-extrabold" style={{ color: "#0f4c81" }}>{item.value}</span>
          <span className="text-xs font-semibold" style={{ color: "#78350f" }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
