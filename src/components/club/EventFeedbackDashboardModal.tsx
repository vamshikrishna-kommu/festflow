import { useState, useEffect } from 'react'
import {
  Star,
  User,
  ShieldCheck,
} from 'lucide-react'
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui'
import {
  getEventFeedback,
  getEventFeedbackSummary,
  type FeedbackSummary,
} from '@/lib/feedback'
import type { EventFeedbackRecord } from '@/types'

interface EventFeedbackDashboardModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventTitle: string
}

export function EventFeedbackDashboardModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
}: EventFeedbackDashboardModalProps) {
  const [feedback, setFeedback] = useState<EventFeedbackRecord[]>([])
  const [summary, setSummary] = useState<FeedbackSummary>({
    averageRating: 0,
    totalReviews: 0,
    ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    recommendationPercentage: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && eventId) {
      setLoading(true)
      Promise.all([
        getEventFeedback(eventId),
        getEventFeedbackSummary(eventId),
      ]).then(([fbRes, sumRes]) => {
        setLoading(false)
        if (fbRes.feedback) setFeedback(fbRes.feedback)
        setSummary(sumRes)
      })
    }
  }, [isOpen, eventId])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Attendee Feedback & Experience Ratings">
      <ModalBody>
        <div className="flex flex-col gap-5">
          <p className="text-xs text-gray-600">
            Real attendee reviews, star ratings, and feedback submitted for{' '}
            <strong className="text-gray-900">"{eventTitle}"</strong>.
          </p>

          {/* Rating Summary Card */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 text-center border-b sm:border-b-0 sm:border-r border-gray-200">
              <span className="text-4xl font-extrabold font-heading text-gray-900 tracking-tight">
                {summary.averageRating > 0 ? summary.averageRating : '—'}
              </span>
              <div className="flex items-center gap-1 my-1.5 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= Math.round(summary.averageRating) ? 'currentColor' : 'none'}
                    className={star <= Math.round(summary.averageRating) ? 'text-amber-500' : 'text-gray-300'}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {summary.totalReviews} verified {summary.totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            {/* Breakdown Bars */}
            <div className="sm:col-span-8 flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = summary.ratingCounts[stars] || 0
                const pct = summary.totalReviews > 0 ? Math.round((count / summary.totalReviews) * 100) : 0
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <span className="w-12 text-gray-600 flex items-center gap-1 font-mono text-[11px]">
                      {stars} <Star size={11} className="text-amber-500" fill="currentColor" />
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-gray-500 text-[10px]">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Attendees Comments List */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Attendee Reviews ({feedback.length})
            </span>

            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading attendee feedback...</div>
              ) : feedback.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No feedback submitted yet. Students receive a feedback prompt after attending the event.
                </div>
              ) : (
                feedback.map((item) => {
                  const studentName = item.is_anonymous
                    ? 'Verified Attendee (Anonymous)'
                    : item.user?.display_name || 'Verified Student'

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-white border border-gray-200 flex flex-col gap-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500">
                            <User size={13} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-900 block">
                              {studentName}
                            </span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <ShieldCheck size={11} className="text-emerald-600" />
                              Admitted Attendee • {new Date(item.created_at).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 text-amber-500">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={12}
                              fill={star <= item.rating ? 'currentColor' : 'none'}
                              className={star <= item.rating ? 'text-amber-500' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                      </div>

                      {item.comment && (
                        <p className="text-xs text-gray-700 pl-9 font-normal leading-relaxed">
                          "{item.comment}"
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  )
}

