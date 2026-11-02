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
        <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
          <Ticket size={18} className="text-[#18CFFC]" />
          Ticket Categories & Passes
        </h2>
        <span className="text-xs text-zinc-400">
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
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 text-left relative overflow-hidden ${
                isSelected
                  ? 'bg-gradient-to-br from-[#14141A] to-[#1E1E28] border-[#18CFFC] shadow-[0_0_20px_rgba(24,207,252,0.15)] ring-1 ring-[#18CFFC]'
                  : canChoose
                  ? 'bg-[#0E0E12] border-white/[0.08] hover:border-white/20 cursor-pointer'
                  : 'bg-[#0A0A0E] border-white/[0.04] opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Selected Ambient Glow */}
              {isSelected && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#18CFFC]/10 rounded-full blur-2xl pointer-events-none" />
              )}

              {/* Tier Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-sm sm:text-base text-white">
                      {tier.name}
                    </h3>
                    {getTierBadge(tier.tier_type)}
                  </div>
                  {tier.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {tier.description}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    {tier.original_price && tier.original_price > tier.price && (
                      <span className="text-xs text-zinc-500 line-through">
                        ₹{tier.original_price}
                      </span>
                    )}
                    <span className="text-base sm:text-lg font-extrabold font-heading text-white">
                      {tier.price === 0 ? <span className="text-emerald-400">Free</span> : `₹${tier.price}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">per pass</span>
                </div>
              </div>

              {/* Perks List */}
              {Array.isArray(tier.perks) && tier.perks.length > 0 && (
                <div className="flex flex-col gap-1 pt-2 border-t border-white/[0.06]">
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <Sparkles size={12} className="text-[#18CFFC] shrink-0" />
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Eligibility & Availability Footer */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.06] text-zinc-400">
                <div className="flex items-center gap-1">
                  {isSoldOut ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} /> Sold Out
                    </span>
                  ) : !isAvailableTime ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock size={12} /> Sales Closed
                    </span>
                  ) : remaining <= 15 ? (
                    <span className="text-amber-400 font-medium">
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
                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-[#18CFFC] text-black font-bold shadow-md shadow-[#18CFFC]/30'
                        : 'bg-white/10 hover:bg-white/15 text-white'
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

