import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Pin,
  Send,
  CornerDownRight,
  Shield,
  Trash2,
  Flag,
  EyeOff,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import type { EventDiscussionRecord } from '@/types'
import {
  getEventDiscussions,
  postEventComment,
  deleteEventComment,
  togglePinEventComment,
  toggleHideEventComment,
} from '@/lib/discussions'
import { ReportModal } from '@/components/community/ReportModal'

interface EventDiscussionSectionProps {
  eventId: string
  clubId?: string
  isOrganizer: boolean
}

export function EventDiscussionSection({
  eventId,
  clubId: _clubId,
  isOrganizer,
}: EventDiscussionSectionProps) {
  const { user } = useAuth()
  const [discussions, setDiscussions] = useState<EventDiscussionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTargetId, setReportTargetId] = useState('')

  const loadComments = async () => {
    setLoading(true)
    const res = await getEventDiscussions(eventId)
    setLoading(false)
    if (res.success) {
      setDiscussions(res.discussions)
    }
  }

  useEffect(() => {
    if (eventId) {
      loadComments()
    }
  }, [eventId])

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim()) return

    setIsPosting(true)
    const res = await postEventComment({
      eventId,
      userId: user.id,
      content: newComment.trim(),
      isOrganizerResponse: isOrganizer,
    })
    setIsPosting(false)

    if (res.success && res.comment) {
      setNewComment('')
      loadComments()
    }
  }

  const handlePostReply = async (parentId: string) => {
    if (!user || !replyText.trim()) return

    setIsReplying(true)
    const res = await postEventComment({
      eventId,
      userId: user.id,
      content: replyText.trim(),
      parentId,
      isOrganizerResponse: isOrganizer,
    })
    setIsReplying(false)

    if (res.success) {
      setReplyText('')
      setReplyingToId(null)
      loadComments()
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!user) return
    const res = await deleteEventComment(commentId, user.id)
    if (res.success) {
      loadComments()
    }
  }

  const handleTogglePin = async (commentId: string, currentPin: boolean) => {
    const res = await togglePinEventComment(commentId, !currentPin)
    if (res.success) {
      loadComments()
    }
  }

  const handleToggleHide = async (commentId: string) => {
    const res = await toggleHideEventComment(commentId, true)
    if (res.success) {
      loadComments()
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-6 border-t border-white/[0.08]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-[#18CFFC]" />
            Event Q&A & Community Discussion
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Ask questions about prerequisites, schedules, venue details, or team requirements.
          </p>
        </div>

        <span className="text-xs font-mono text-[var(--color-text-muted)] self-start sm:self-auto px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
          {discussions.length} {discussions.length === 1 ? 'Thread' : 'Threads'}
        </span>
      </div>

      {/* Post New Question Box */}
      {user ? (
        <form onSubmit={handlePostQuestion} className="flex flex-col gap-2.5 p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white">Ask an organizer or start a discussion</span>
            {isOrganizer && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Shield size={10} /> Replying as Club Organizer
              </span>
            )}
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Type your question or message regarding this event..."
            rows={2}
            className="w-full p-3 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.08] text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Be respectful and adhere to campus community guidelines.
            </span>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isPosting}
              disabled={!newComment.trim() || isPosting}
              leftIcon={<Send size={13} />}
            >
              Post Question
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <span>Sign in with your campus account to ask questions or join the event discussion.</span>
        </div>
      )}

      {/* Discussion List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#18CFFC] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)] font-mono">Loading discussions…</span>
        </div>
      ) : discussions.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[#0E0E12] border border-white/[0.06] text-xs text-[var(--color-text-muted)]">
          <MessageSquare size={28} className="mx-auto mb-2 text-zinc-600" />
          <p className="font-semibold text-zinc-400">No questions posted yet.</p>
          <p className="mt-0.5">Be the first to ask the organizers about this event!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {discussions.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 sm:p-5 rounded-2xl border transition ${
                comment.is_pinned
                  ? 'bg-amber-500/[0.03] border-amber-500/30'
                  : 'bg-[#0E0E12] border-white/[0.08]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {comment.author?.display_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {comment.author?.display_name || 'Campus Student'}
                      </span>
                      {comment.is_organizer_response && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#18CFFC]/15 text-[#18CFFC] border border-[#18CFFC]/30">
                          <Shield size={10} /> Organizer
                        </span>
                      )}
                      {comment.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Pin size={10} /> Pinned Answer
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="flex items-center gap-1">
                  {isOrganizer && (
                    <button
                      onClick={() => handleTogglePin(comment.id, comment.is_pinned)}
                      className={`p-1.5 rounded-lg text-xs transition ${
                        comment.is_pinned
                          ? 'text-amber-400 bg-amber-500/15'
                          : 'text-zinc-500 hover:text-white'
                      }`}
                      title={comment.is_pinned ? 'Unpin' : 'Pin to Top'}
                    >
                      <Pin size={13} />
                    </button>
                  )}

                  {isOrganizer && (
                    <button
                      onClick={() => handleToggleHide(comment.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white text-xs transition"
                      title="Hide Inappropriate Comment"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}

                  {(user?.id === comment.user_id || isOrganizer) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 text-xs transition"
                      title="Delete Comment"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  {user && user.id !== comment.user_id && (
                    <button
                      onClick={() => {
                        setReportTargetId(comment.id)
                        setReportModalOpen(true)
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 text-xs transition"
                      title="Report Comment"
                    >
                      <Flag size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Content */}
              <p className="text-xs text-zinc-200 leading-relaxed pl-10 whitespace-pre-wrap">
                {comment.content}
              </p>

              {/* Reply Trigger */}
              {user && (
                <div className="pl-10 mt-3">
                  <button
                    onClick={() => {
                      if (replyingToId === comment.id) {
                        setReplyingToId(null)
                      } else {
                        setReplyingToId(comment.id)
                        setReplyText('')
                      }
                    }}
                    className="text-[11px] font-semibold text-[#18CFFC] hover:underline flex items-center gap-1"
                  >
                    <CornerDownRight size={12} />
                    {replyingToId === comment.id ? 'Cancel Reply' : 'Reply'}
                  </button>
                </div>
              )}

              {/* Replying Box */}
              {replyingToId === comment.id && (
                <div className="mt-3 pl-10">
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.08] flex flex-col gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      rows={2}
                      className="w-full p-2 rounded-lg bg-[var(--color-surface-1)] border border-white/[0.08] text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReplyingToId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isReplying}
                        disabled={!replyText.trim() || isReplying}
                        onClick={() => handlePostReply(comment.id)}
                      >
                        Post Reply
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Nested Replies List */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 pl-10 flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
                  {comment.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#18CFFC]/20 text-[#18CFFC] text-[10px] font-bold flex items-center justify-center">
                            {reply.author?.display_name?.charAt(0) || 'U'}
                          </div>
                          <span className="text-xs font-semibold text-white">
                            {reply.author?.display_name || 'Student'}
                          </span>
                          {reply.is_organizer_response && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#18CFFC]/15 text-[#18CFFC] border border-[#18CFFC]/30">
                              <Shield size={9} /> Organizer
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {(user?.id === reply.user_id || isOrganizer) && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 text-xs"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap pl-8">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType="comment"
        targetId={reportTargetId}
      />
    </div>
  )
}
