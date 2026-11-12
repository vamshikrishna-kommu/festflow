import { Plus, Trash2 } from 'lucide-react'
import { generateTempId, CATEGORY_PRESET_COLORS } from '@/lib/seatLayoutEditor'
import type { LayoutEditorConfig } from '@/types/seating'

interface Props {
  config: LayoutEditorConfig
  onChange: (config: LayoutEditorConfig) => void
}

export function Step3Categories({ config, onChange }: Props) {
  const addCategory = () => {
    const nextColor = CATEGORY_PRESET_COLORS[config.categories.length % CATEGORY_PRESET_COLORS.length]
    onChange({
      ...config,
      categories: [
        ...config.categories,
        {
          tempId: generateTempId(),
          name: `Category ${config.categories.length + 1}`,
          color: nextColor,
          price: 0,
          description: '',
          sort_order: config.categories.length,
        },
      ],
    })
  }

  const updateCategory = (tempId: string, patch: Partial<typeof config.categories[0]>) => {
    onChange({
      ...config,
      categories: config.categories.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)),
    })
  }

  const removeCategory = (tempId: string) => {
    onChange({
      ...config,
      categories: config.categories.filter((c) => c.tempId !== tempId),
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Seat Categories</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Define pricing zones. Assign categories to seats in the layout editor. Free events can use a single ₹0 category.
        </p>
      </div>

      <div className="space-y-3">
        {config.categories.map((cat) => (
          <div
            key={cat.tempId}
            className="p-4 bg-[var(--color-surface-2)] rounded-xl border border-white/5 space-y-4"
          >
            <div className="flex items-start gap-4">
              {/* Color */}
              <div className="flex-shrink-0">
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateCategory(cat.tempId, { color })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        cat.color === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={cat.name}
                    onChange={(e) => updateCategory(cat.tempId, { name: e.target.value })}
                    placeholder="e.g. VIP, Standard"
                    className="w-full px-3 py-2 bg-[var(--color-surface-3)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={cat.price}
                    onChange={(e) => updateCategory(cat.tempId, { price: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-3 py-2 bg-[var(--color-surface-3)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Description</label>
                  <input
                    type="text"
                    value={cat.description}
                    onChange={(e) => updateCategory(cat.tempId, { description: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-[var(--color-surface-3)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC] transition-colors"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeCategory(cat.tempId)}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors mt-5"
                title="Remove category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCategory}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 text-sm text-[var(--color-text-muted)] hover:border-[#18CFFC]/50 hover:text-[#18CFFC] transition-colors w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        Add Category
      </button>
    </div>
  )
}

