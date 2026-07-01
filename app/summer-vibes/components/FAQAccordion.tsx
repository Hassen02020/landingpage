"use client"

import { useState } from "react"
import { FAQ_ITEMS } from "../data/faq"

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl shadow-sm border overflow-hidden transition-all"
          style={{ backgroundColor: "#f8f9fc", borderColor: openIndex === i ? "#0f4c81" : "#e5e7eb" }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full p-5 text-left flex items-center justify-between"
          >
            <h3 className="font-bold text-base" style={{ color: "#0f4c81" }}>{item.q}</h3>
            <span className="text-2xl transition-transform" style={{ transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)" }}>
              {openIndex === i ? "−" : "+"}
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: openIndex === i ? "200px" : "0px" }}
          >
            <p className="px-5 pb-5 text-gray-700 text-sm leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
