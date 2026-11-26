import { Check } from 'lucide-react'
import type { BookingStage } from '@/types/seating'

interface BookingProgressBarProps {
  currentStage: BookingStage
  isFreeEvent: boolean
}

export function BookingProgressBar({ currentStage, isFreeEvent }: BookingProgressBarProps) {
  const steps: { stage: BookingStage; label: string }[] = isFreeEvent
    ? [
        { stage: 'seats', label: '1. Select Seats' },
        { stage: 'details', label: '2. Attendee Details' },
        { stage: 'success', label: '3. Digital Pass' },
      ]
    : [
        { stage: 'seats', label: '1. Select Seats' },
        { stage: 'details', label: '2. Attendee Details' },
        { stage: 'payment', label: '3. UPI Payment' },
        { stage: 'success', label: '4. Pass / Status' },
      ]

  const stageOrder: Record<BookingStage, number> = isFreeEvent
    ? { seats: 0, details: 1, payment: 1, success: 2 }
    : { seats: 0, details: 1, payment: 2, success: 3 }

  const currentIdx = stageOrder[currentStage] ?? 0

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto px-2">
        {steps.map((s, idx) => {
          const isDone = idx < currentIdx
          const isCurrent = idx === currentIdx

          return (
            <div key={s.stage} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-600/15 font-bold'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4 stroke-[2.5]" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] mt-1.5 font-medium tracking-tight transition-colors ${
                    isCurrent
                      ? 'text-blue-700 font-semibold'
                      : isDone
                        ? 'text-emerald-700'
                        : 'text-gray-500'
                  }`}
                >
                  {s.label.replace(/^\d+\.\s*/, '')}
                </span>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 -mt-5 transition-colors duration-200 ${
                    idx < currentIdx ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
