import { useState } from 'react'
import { ShoppingBag, Plus, Minus, Info } from 'lucide-react'
import type { EventAddon } from '@/types'

interface EventAddonsSectionProps {
  addons: EventAddon[]
}

export function EventAddonsSection({ addons }: EventAddonsSectionProps) {
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({})

  if (!addons || addons.length === 0) return null

  const handleIncrement = (addonId: string, max: number, stock: number) => {
    const current = selectedCounts[addonId] || 0
    if (current < Math.min(max, stock)) {
      setSelectedCounts({ ...selectedCounts, [addonId]: current + 1 })
    }
  }

  const handleDecrement = (addonId: string) => {
    const current = selectedCounts[addonId] || 0
    if (current > 0) {
      setSelectedCounts({ ...selectedCounts, [addonId]: current - 1 })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
            <ShoppingBag size={18} className="text-blue-600" />
            Official Fest Merchandise & Add-ons
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Exclusive commemorative fest apparel, hardware workshop kits, and vouchers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {addons.map((addon) => {
          const qty = selectedCounts[addon.id] || 0
          const remaining = Math.max(0, addon.stock_quantity - addon.sold_quantity)
          const isSoldOut = remaining <= 0

          return (
            <div
              key={addon.id}
              className="p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all flex flex-col justify-between gap-3 text-left shadow-xs"
            >
              <div>
                {/* Image */}
                {addon.image_url ? (
                  <div className="w-full h-36 rounded-lg overflow-hidden mb-3 bg-gray-100">
                    <img
                      src={addon.image_url}
                      alt={addon.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-28 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 mb-3">
                    <ShoppingBag size={32} />
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-gray-900">{addon.name}</h3>
                  <span className="text-sm font-extrabold text-blue-600 font-mono shrink-0">
                    ₹{addon.price}
                  </span>
                </div>

                {addon.description && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    {addon.description}
                  </p>
                )}
              </div>

              {/* Stock and Counter Footer */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {isSoldOut ? (
                    <span className="text-rose-600 font-semibold">Sold Out</span>
                  ) : (
                    `${remaining} in stock`
                  )}
                </span>

                {!isSoldOut && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={qty <= 0}
                      onClick={() => handleDecrement(addon.id)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="font-mono text-xs font-bold text-gray-900 w-5 text-center">
                      {qty}
                    </span>
                    <button
                      type="button"
                      disabled={qty >= Math.min(addon.max_per_user, remaining)}
                      onClick={() =>
                        handleIncrement(addon.id, addon.max_per_user, remaining)
                      }
                      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Manual UPI Integration Notice */}
      <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-start gap-2.5 text-xs text-gray-600">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Official merchandise items can be claimed alongside your registration pass. In accordance with campus fest guidelines, any merchandise payments are verified via direct UPI at the organizer registration desk.
        </p>
      </div>
    </div>
  )
}
