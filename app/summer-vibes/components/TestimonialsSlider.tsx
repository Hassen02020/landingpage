"use client"

import { useState } from "react"
import { TESTIMONIALS } from "../data/testimonials"

export function TestimonialsSlider() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  }

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {TESTIMONIALS.map((review) => (
            <div key={review.name} className="w-full flex-shrink-0 px-4">
              <div
                className="p-6 rounded-2xl shadow-sm border mx-auto max-w-md"
                style={{ backgroundColor: "#f8f9fc", borderColor: "#e5e7eb" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{review.avatar}</span>
                  <div>
                    <p className="font-bold text-base" style={{ color: "#0f4c81" }}>{review.name}</p>
                    <div className="flex items-center gap-1">
                      {Array(review.rating).fill(0).map((_, i) => (
                        <span key={i} className="text-yellow-400 text-sm">⭐</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">"{review.text}"</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-2 mt-6">
        <button
          onClick={prevSlide}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ backgroundColor: "#0f4c81", color: "#fff" }}
          aria-label="Témoignage précédent"
        >
          ←
        </button>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className="w-3 h-3 rounded-full transition-all"
            style={{ backgroundColor: currentIndex === i ? "#0f4c81" : "#e5e7eb" }}
            aria-label={`Témoignage ${i + 1}`}
          />
        ))}
        <button
          onClick={nextSlide}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ backgroundColor: "#0f4c81", color: "#fff" }}
          aria-label="Témoignage suivant"
        >
          →
        </button>
      </div>
    </div>
  )
}
