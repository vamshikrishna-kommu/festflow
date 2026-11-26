import { useState } from 'react'
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  HelpCircle,
  Calendar,
  Users,
  Image,
  FileText,
  Megaphone,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EventPageSection, EventPageSectionType } from '@/types'

interface EventPageBuilderProps {
  layout: EventPageSection[]
  onChange: (layout: EventPageSection[]) => void
}

const DEFAULT_SECTIONS: Array<{
  type: EventPageSectionType
  title: string
  description: string
  icon: typeof Sparkles
  defaultContent: Record<string, any>
}> = [
  {
    type: 'hero',
    title: 'Hero & Header',
    description: 'Dynamic banner with event title, dates, registration CTA, and background glow.',
    icon: Sparkles,
    defaultContent: { tagline: 'The Ultimate Campus Experience', highlightBadge: 'Official Campus Fest' },
  },
  {
    type: 'intro',
    title: 'Executive Summary',
    description: 'High-level introduction and key takeaways for prospective attendees.',
    icon: FileText,
    defaultContent: { highlightCards: ['Hands-on Workshops', 'Industry Mentors', 'Cash Prizes & Swag'] },
  },
  {
    type: 'about',
    title: 'About the Event',
    description: 'In-depth description, theme details, and organizers note.',
    icon: FileText,
    defaultContent: { theme: 'Innovation & Collaboration' },
  },
  {
    type: 'schedule',
    title: 'Event Schedule & Timeline',
    description: 'Step-by-step agenda detailing keynotes, hack hours, lunch, and presentations.',
    icon: Calendar,
    defaultContent: {
      items: [
        { time: '09:00 AM', title: 'Registration Desk & Welcome Kit', venue: 'Main Auditorium' },
        { time: '10:30 AM', title: 'Opening Keynote & Challenge Reveal', venue: 'Stage A' },
        { time: '01:00 PM', title: 'Networking Lunch', venue: 'Student Center' },
        { time: '04:30 PM', title: 'Final Presentations & Awards', venue: 'Auditorium' },
      ],
    },
  },
  {
    type: 'speakers',
    title: 'Featured Speakers & Mentors',
    description: 'Showcase keynote guests, judges, and workshop instructors.',
    icon: Users,
    defaultContent: {
      speakers: [
        { name: 'Dr. Ramesh Sharma', role: 'Chief Guest / Professor', topic: 'Future of Tech Innovation' },
      ],
    },
  },
  {
    type: 'gallery',
    title: 'Moments & Past Editions',
    description: 'Photo highlights and atmosphere from previous campus fests.',
    icon: Image,
    defaultContent: { photos: [] },
  },
  {
    type: 'faqs',
    title: 'Frequently Asked Questions',
    description: 'Clear answers on eligibility, entry requirements, food, and laptop rules.',
    icon: HelpCircle,
    defaultContent: {
      faqs: [
        { question: 'Who can register for this event?', answer: 'Open to all verified college students with a valid college ID.' },
        { question: 'Is prior technical experience required?', answer: 'Beginners and experienced students alike are welcome!' },
      ],
    },
  },
  {
    type: 'cta',
    title: 'Registration Call to Action',
    description: 'High-contrast bottom banner urging students to secure their passes.',
    icon: Megaphone,
    defaultContent: { ctaTitle: 'Seats are strictly limited!', ctaSubtitle: 'Claim your confirmed digital pass before capacity fills.' },
  },
]

export function EventPageBuilder({ layout, onChange }: EventPageBuilderProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(layout[0]?.id || null)

  // Initialize with defaults if empty
  const currentSections: EventPageSection[] =
    layout.length > 0
      ? layout
      : DEFAULT_SECTIONS.map((sec, idx) => ({
          id: `sec_${sec.type}_${idx}`,
          type: sec.type,
          title: sec.title,
          enabled: true,
          content: sec.defaultContent,
        }))

  const handleToggleSection = (id: string) => {
    const updated = currentSections.map((sec) =>
      sec.id === id ? { ...sec, enabled: !sec.enabled } : sec
    )
    onChange(updated)
  }

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const updated = [...currentSections]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    onChange(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index >= currentSections.length - 1) return
    const updated = [...currentSections]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index] = temp
    onChange(updated)
  }

  const handleUpdateContent = (id: string, newContent: Record<string, any>) => {
    const updated = currentSections.map((sec) =>
      sec.id === id ? { ...sec, content: { ...(sec.content || {}), ...newContent } } : sec
    )
    onChange(updated)
  }

  const selectedSection = currentSections.find((s) => s.id === activeSectionId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Visual Event Detail Page Builder
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Customize which sections appear on your public event page and reorder them via drag/arrows.
          </p>
        </div>
        <Badge variant="info" className="text-xs">
          {currentSections.filter((s) => s.enabled).length} Active Sections
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Section List & Reordering */}
        <div className="lg:col-span-5 flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            Page Layout Sections
          </span>

          <div className="flex flex-col gap-2">
            {currentSections.map((section, idx) => {
              const def = DEFAULT_SECTIONS.find((d) => d.type === section.type)
              const Icon = def?.icon || FileText
              const isSelected = activeSectionId === section.id

              return (
                <div
                  key={section.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                      : section.enabled
                      ? 'bg-white border-gray-200 hover:border-gray-300'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div
                    onClick={() => setActiveSectionId(section.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        section.enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {section.title || def?.title}
                        </span>
                        {!section.enabled && (
                          <span className="text-[10px] text-gray-500 font-mono">Hidden</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 truncate block">
                        {def?.description}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentSections.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSection(section.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                        section.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {section.enabled ? 'Active' : 'Off'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Active Section Editor */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-white border border-gray-200 shadow-xs flex flex-col gap-4">
          {selectedSection ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>Edit Section:</span>
                    <span className="text-blue-600">{selectedSection.title}</span>
                  </h4>
                  <span className="text-xs text-gray-500">
                    Type: <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{selectedSection.type}</code>
                  </span>
                </div>
                <Badge variant={selectedSection.enabled ? 'success' : 'neutral'}>
                  {selectedSection.enabled ? 'Visible on page' : 'Disabled'}
                </Badge>
              </div>

              {/* Dynamic Section Content Config */}
              {selectedSection.type === 'hero' && (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-700">
                    Header Tagline / Accent
                  </label>
                  <input
                    type="text"
                    value={selectedSection.content?.tagline || ''}
                    onChange={(e) => handleUpdateContent(selectedSection.id, { tagline: e.target.value })}
                    placeholder="e.g. 36-Hour National Flagship Hackathon"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  />
                  <label className="text-xs font-semibold text-gray-700 mt-1">
                    Highlight Pill Badge
                  </label>
                  <input
                    type="text"
                    value={selectedSection.content?.highlightBadge || ''}
                    onChange={(e) => handleUpdateContent(selectedSection.id, { highlightBadge: e.target.value })}
                    placeholder="e.g. Official IEEE Fest 2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>
              )}

              {selectedSection.type === 'schedule' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Schedule Sessions</span>
                    <button
                      type="button"
                      onClick={() => {
                        const items = selectedSection.content?.items || []
                        handleUpdateContent(selectedSection.id, {
                          items: [...items, { time: '12:00 PM', title: 'New Session', venue: 'Campus' }],
                        })
                      }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Plus size={12} /> Add Session
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {(selectedSection.content?.items || []).map((item: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
                        <input
                          type="text"
                          value={item.time || ''}
                          onChange={(e) => {
                            const items = [...(selectedSection.content?.items || [])]
                            items[i] = { ...items[i], time: e.target.value }
                            handleUpdateContent(selectedSection.id, { items })
                          }}
                          placeholder="Time"
                          className="w-24 px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:border-blue-600"
                        />
                        <input
                          type="text"
                          value={item.title || ''}
                          onChange={(e) => {
                            const items = [...(selectedSection.content?.items || [])]
                            items[i] = { ...items[i], title: e.target.value }
                            handleUpdateContent(selectedSection.id, { items })
                          }}
                          placeholder="Session Title"
                          className="flex-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:border-blue-600"
                        />
                        <input
                          type="text"
                          value={item.venue || ''}
                          onChange={(e) => {
                            const items = [...(selectedSection.content?.items || [])]
                            items[i] = { ...items[i], venue: e.target.value }
                            handleUpdateContent(selectedSection.id, { items })
                          }}
                          placeholder="Venue"
                          className="w-28 px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const items = (selectedSection.content?.items || []).filter((_: any, idx: number) => idx !== i)
                            handleUpdateContent(selectedSection.id, { items })
                          }}
                          className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSection.type === 'speakers' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Speakers & Guests</span>
                    <button
                      type="button"
                      onClick={() => {
                        const speakers = selectedSection.content?.speakers || []
                        handleUpdateContent(selectedSection.id, {
                          speakers: [...speakers, { name: 'New Speaker', role: 'Guest Speaker', topic: 'Keynote' }],
                        })
                      }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Plus size={12} /> Add Speaker
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {(selectedSection.content?.speakers || []).map((sp: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={sp.name || ''}
                            onChange={(e) => {
                              const speakers = [...(selectedSection.content?.speakers || [])]
                              speakers[i] = { ...speakers[i], name: e.target.value }
                              handleUpdateContent(selectedSection.id, { speakers })
                            }}
                            placeholder="Speaker Full Name"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                          />
                          <input
                            type="text"
                            value={sp.role || ''}
                            onChange={(e) => {
                              const speakers = [...(selectedSection.content?.speakers || [])]
                              speakers[i] = { ...speakers[i], role: e.target.value }
                              handleUpdateContent(selectedSection.id, { speakers })
                            }}
                            placeholder="Designation / Org"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const speakers = (selectedSection.content?.speakers || []).filter((_: any, idx: number) => idx !== i)
                              handleUpdateContent(selectedSection.id, { speakers })
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={sp.topic || ''}
                          onChange={(e) => {
                            const speakers = [...(selectedSection.content?.speakers || [])]
                            speakers[i] = { ...speakers[i], topic: e.target.value }
                            handleUpdateContent(selectedSection.id, { speakers })
                          }}
                          placeholder="Session Topic / Talk Title"
                          className="w-full px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-700 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSection.type === 'faqs' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Frequently Asked Questions</span>
                    <button
                      type="button"
                      onClick={() => {
                        const faqs = selectedSection.content?.faqs || []
                        handleUpdateContent(selectedSection.id, {
                          faqs: [...faqs, { question: 'New Question?', answer: 'Answer here.' }],
                        })
                      }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Plus size={12} /> Add FAQ
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {(selectedSection.content?.faqs || []).map((faq: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={faq.question || ''}
                            onChange={(e) => {
                              const faqs = [...(selectedSection.content?.faqs || [])]
                              faqs[i] = { ...faqs[i], question: e.target.value }
                              handleUpdateContent(selectedSection.id, { faqs })
                            }}
                            placeholder="Question"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 font-medium focus:outline-none focus:border-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const faqs = (selectedSection.content?.faqs || []).filter((_: any, idx: number) => idx !== i)
                              handleUpdateContent(selectedSection.id, { faqs })
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={faq.answer || ''}
                          onChange={(e) => {
                            const faqs = [...(selectedSection.content?.faqs || [])]
                            faqs[i] = { ...faqs[i], answer: e.target.value }
                            handleUpdateContent(selectedSection.id, { faqs })
                          }}
                          placeholder="Answer explanation..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-700 resize-none focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSection.type === 'cta' && (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-700">Banner Headline</label>
                  <input
                    type="text"
                    value={selectedSection.content?.ctaTitle || ''}
                    onChange={(e) => handleUpdateContent(selectedSection.id, { ctaTitle: e.target.value })}
                    placeholder="e.g. Seats are filling fast!"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
                  />
                  <label className="text-xs font-semibold text-gray-700 mt-1">Banner Subtitle</label>
                  <input
                    type="text"
                    value={selectedSection.content?.ctaSubtitle || ''}
                    onChange={(e) => handleUpdateContent(selectedSection.id, { ctaSubtitle: e.target.value })}
                    placeholder="e.g. Join hundreds of students across campus."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
                <span>All layout changes are saved with the event.</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 size={12} /> Live preview ready
                </span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500 text-xs">
              Select a section from the left column to customize its parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

