"use client"

import { useState, useEffect } from "react"

const TARGET_DATE = new Date("2026-07-31T23:59:59")

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = TARGET_DATE.getTime() - now.getTime()

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
