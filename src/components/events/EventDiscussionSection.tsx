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
    <div className="flex flex-col gap-6 pt-6 border-t border-gray-200">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            Event Q&A & Community Discussion
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ask questions about prerequisites, schedules, venue details, or team requirements.
          </p>
        </div>

        <span className="text-xs font-mono text-gray-600 self-start sm:self-auto px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
          {discussions.length} {discussions.length === 1 ? 'Thread' : 'Threads'}
        </span>
      </div>

      {/* Post New Question Box */}
      {user ? (
        <form onSubmit={handlePostQuestion} className="flex flex-col gap-2.5 p-4 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-900">Ask an organizer or start a discussion</span>
            {isOrganizer && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Shield size={10} /> Replying as Club Organizer
              </span>
            )}
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Type your question or message regarding this event..."
            rows={2}
            className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
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
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-600 flex items-center justify-center gap-2">
          <span>Sign in with your campus account to ask questions or join the event discussion.</span>
        </div>
      )}

      {/* Discussion List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-3" />
          <span className="text-xs text-gray-500 font-mono">Loading discussions…</span>
        </div>
      ) : discussions.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white border border-gray-200 text-xs text-gray-500">
          <MessageSquare size={28} className="mx-auto mb-2 text-gray-400" />
          <p className="font-semibold text-gray-700">No questions posted yet.</p>
          <p className="mt-0.5">Be the first to ask the organizers about this event!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {discussions.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 sm:p-5 rounded-xl border transition shadow-xs ${
                comment.is_pinned
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {comment.author?.display_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">
                        {comment.author?.display_name || 'Campus Student'}
                      </span>
                      {comment.is_organizer_response && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Shield size={10} /> Organizer
                        </span>
                      )}
                      {comment.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <Pin size={10} /> Pinned Answer
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="flex items-center gap-1">
                  {isOrganizer && (
                    <button
                      onClick={() => handleTogglePin(comment.id, comment.is_pinned)}
                      className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                        comment.is_pinned
                          ? 'text-amber-700 bg-amber-100'
                          : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      title={comment.is_pinned ? 'Unpin' : 'Pin to Top'}
                    >
                      <Pin size={13} />
                    </button>
                  )}

                  {isOrganizer && (
                    <button
                      onClick={() => handleToggleHide(comment.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs transition cursor-pointer"
                      title="Hide Inappropriate Comment"
                    >
                      <EyeOff size={13} />
                    </button>
                  )}

                  {(user?.id === comment.user_id || isOrganizer) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition cursor-pointer"
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
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 text-xs transition cursor-pointer"
                      title="Report Comment"
                    >
                      <Flag size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Content */}
              <p className="text-xs text-gray-700 leading-relaxed pl-10 whitespace-pre-wrap">
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
                    className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CornerDownRight size={12} />
                    {replyingToId === comment.id ? 'Cancel Reply' : 'Reply'}
                  </button>
                </div>
              )}

              {/* Replying Box */}
              {replyingToId === comment.id && (
                <div className="mt-3 pl-10">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      rows={2}
                      className="w-full p-2 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600"
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
                <div className="mt-4 pl-10 flex flex-col gap-3 pt-3 border-t border-gray-100">
                  {comment.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-3 rounded-xl bg-gray-50 border border-gray-200"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                            {reply.author?.display_name?.charAt(0) || 'U'}
                          </div>
                          <span className="text-xs font-semibold text-gray-900">
                            {reply.author?.display_name || 'Student'}
                          </span>
                          {reply.is_organizer_response && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              <Shield size={9} /> Organizer
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500">
                            {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {(user?.id === reply.user_id || isOrganizer) && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="p-1 rounded text-gray-400 hover:text-rose-600 text-xs cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap pl-8">
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
