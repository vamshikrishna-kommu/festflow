import { motion } from 'motion/react'
import { Ticket, Check, Sparkles, Clock, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EventTicketTier } from '@/types'

interface EventTicketTiersSectionProps {
  tiers: EventTicketTier[]
  selectedTierId: string | null
  onSelectTier: (tierId: string) => void
  disabled?: boolean
  isCancelled?: boolean
  isCompleted?: boolean
}

export function EventTicketTiersSection({
  tiers,
  selectedTierId,
  onSelectTier,
  disabled = false,
  isCancelled = false,
  isCompleted = false,
}: EventTicketTiersSectionProps) {
  if (!tiers || tiers.length === 0) return null

  const getTierBadge = (type: string) => {
    switch (type) {
      case 'early_bird':
        return <Badge variant="cyan">Early Bird</Badge>
      case 'vip':
        return <Badge variant="pink">VIP Pass</Badge>
      case 'student':
        return <Badge variant="purple">Student Pass</Badge>
      case 'free':
        return <Badge variant="success">Free Entry</Badge>
      default:
        return <Badge variant="default">Standard</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
          <Ticket size={18} className="text-blue-600" />
          Ticket Categories & Passes
        </h2>
        <span className="text-xs text-gray-500">
          {tiers.length} pass option{tiers.length > 1 ? 's' : ''} available
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {tiers.map((tier) => {
          const isSelected = selectedTierId === tier.id
          const isSoldOut = tier.sold_count >= tier.capacity
          const remaining = Math.max(0, tier.capacity - tier.sold_count)
          const isAvailableTime =
            (!tier.available_from || new Date(tier.available_from) <= new Date()) &&
            (!tier.available_until || new Date(tier.available_until) >= new Date())

          const canChoose = !disabled && !isCancelled && !isCompleted && !isSoldOut && isAvailableTime && tier.is_active

          return (
            <motion.div
              key={tier.id}
              whileHover={canChoose ? { y: -2 } : {}}
              onClick={() => {
                if (canChoose) onSelectTier(tier.id)
              }}
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 text-left relative overflow-hidden ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600 shadow-sm'
                  : canChoose
                  ? 'bg-white border-gray-200 hover:border-gray-300 shadow-xs cursor-pointer'
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Tier Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900">
                      {tier.name}
                    </h3>
                    {getTierBadge(tier.tier_type)}
                  </div>
                  {tier.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {tier.description}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    {tier.original_price && tier.original_price > tier.price && (
                      <span className="text-xs text-gray-400 line-through">
                        ₹{tier.original_price}
                      </span>
                    )}
                    <span className="text-base sm:text-lg font-extrabold font-heading text-gray-900">
                      {tier.price === 0 ? <span className="text-emerald-600">Free</span> : `₹${tier.price}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 block">per pass</span>
                </div>
              </div>

              {/* Perks List */}
              {Array.isArray(tier.perks) && tier.perks.length > 0 && (
                <div className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700">
                      <Sparkles size={12} className="text-blue-600 shrink-0" />
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Eligibility & Availability Footer */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-200 text-gray-500">
                <div className="flex items-center gap-1">
                  {isSoldOut ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} /> Sold Out
                    </span>
                  ) : !isAvailableTime ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock size={12} /> Sales Closed
                    </span>
                  ) : remaining <= 15 ? (
                    <span className="text-amber-600 font-medium">
                      Only {remaining} seat{remaining > 1 ? 's' : ''} left!
                    </span>
                  ) : (
                    <span>{remaining} seats available</span>
                  )}
                </div>

                {canChoose && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectTier(tier.id)
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={12} /> Selected
                      </>
                    ) : (
                      'Select Pass'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

