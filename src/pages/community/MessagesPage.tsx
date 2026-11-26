import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router'
import {
  MessageSquare,
  Send,
  Search,
  Check,
  CheckCheck,
  ShieldAlert,
  Flag,
  ArrowLeft,
  User,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import type { ConversationRecord, DirectMessageRecord } from '@/types'
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
} from '@/lib/messaging'
import { blockUser, isUserBlocked } from '@/lib/moderation'
import { ReportModal } from '@/components/community/ReportModal'

export default function MessagesPage() {
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const toUserId = searchParams.get('to')
  const initialConvId = searchParams.get('conv')

  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [activeConv, setActiveConv] = useState<ConversationRecord | null>(null)
  const [messages, setMessages] = useState<DirectMessageRecord[]>([])
  const [text, setText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load conversations
  useEffect(() => {
    async function loadData() {
      if (!user) return
      setLoadingConv(true)
      const res = await getConversations(user.id)
      setLoadingConv(false)
      if (res.success) {
        setConversations(res.conversations)

        // Select initial conversation
        if (initialConvId) {
          const found = res.conversations.find((c) => c.id === initialConvId)
          if (found) setActiveConv(found)
        } else if (toUserId) {
          const foundWithRecipient = res.conversations.find(
            (c) => c.participant_one === toUserId || c.participant_two === toUserId
          )
          if (foundWithRecipient) {
            setActiveConv(foundWithRecipient)
          } else {
            // Placeholder conversation until first message is sent
            setActiveConv({
              id: '',
              participant_one: user.id,
              participant_two: toUserId,
              created_at: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
              last_message_text: '',
              other_participant: {
                id: toUserId,
                display_name: 'Campus Peer',
                avatar_url: null,
                role: 'student',
                email: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            })
          }
        } else if (res.conversations.length > 0 && window.innerWidth >= 768) {
          setActiveConv(res.conversations[0])
        }
      }
    }

    loadData()
  }, [user, initialConvId, toUserId])

  // Load messages when activeConv changes
  useEffect(() => {
    async function loadMessages() {
      if (!user || !activeConv) return

      const otherId =
        activeConv.participant_one === user.id
          ? activeConv.participant_two
          : activeConv.participant_one

      // Check block status
      const blocked = await isUserBlocked(user.id, otherId)
      setIsBlocked(blocked)

      if (activeConv.id) {
        setLoadingMessages(true)
        setThreadError(null)
        const res = await getConversationMessages(activeConv.id, user.id)
        setLoadingMessages(false)
        if (res.success) {
          setMessages(res.messages)
          // Mark as read
          await markMessagesAsRead(activeConv.id, user.id)
          // Update conversation in list to clear unread
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConv.id ? { ...c, unread_count: 0 } : c))
          )
          setTimeout(scrollToBottom, 100)
        } else {
          setThreadError(res.message || 'Unable to load messages for this conversation.')
        }
      } else {
        setThreadError(null)
        setMessages([])
      }
    }

    loadMessages()
  }, [activeConv, user])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user || !activeConv || !text.trim() || sending || isBlocked) return

    const otherId =
      activeConv.participant_one === user.id
        ? activeConv.participant_two
        : activeConv.participant_one

    const messageContent = text.trim()
    setSendError(null)
    setSending(true)

    const res = await sendMessage({
      senderId: user.id,
      receiverId: otherId,
      content: messageContent,
      conversationId: activeConv.id || undefined,
    })

    setSending(false)

    if (res.success && res.messageRecord) {
      setText('')
      setMessages((prev) => [...prev, res.messageRecord!])
      setTimeout(scrollToBottom, 100)

      // Update conversations list
      if (!activeConv.id && res.conversationId) {
        setActiveConv((prev) => (prev ? { ...prev, id: res.conversationId! } : null))
        setSearchParams({ conv: res.conversationId })
      }

      const refreshed = await getConversations(user.id)
      if (refreshed.success) {
        setConversations(refreshed.conversations)
      }
    } else {
      setSendError(res.message || 'Message could not be sent. Please try again.')
    }
  }

  const handleBlockUser = async () => {
    if (!user || !activeConv) return
    const otherId =
      activeConv.participant_one === user.id
        ? activeConv.participant_two
        : activeConv.participant_one

    const confirmed = window.confirm(
      'Are you sure you want to block this user? You will no longer be able to message each other.'
    )
    if (!confirmed) return

    const res = await blockUser(user.id, otherId)
    if (res.success) {
      setIsBlocked(true)
    }
  }

  const otherParticipant = activeConv
    ? (activeConv as any).other_participant || {
        id:
          activeConv.participant_one === user?.id
            ? activeConv.participant_two
            : activeConv.participant_one,
        display_name: 'Participant',
        avatar_url: null,
      }
    : null

  const filteredConversations = conversations.filter((c) => {
    const name = (c as any).other_participant?.display_name || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-left">
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs h-[78vh] flex flex-col md:flex-row">
          {/* Left Column: Conversations List */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col ${
              activeConv ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Header & Search */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Messages
                </h1>
                <span className="text-xs font-mono text-gray-500">
                  {conversations.length} chats
                </span>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search participants…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {loadingConv ? (
                <div className="p-8 text-center text-xs text-gray-500 font-mono">
                  Loading chats…
                </div>
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => {
                  const participant = (conv as any).other_participant
                  const isSelected = activeConv?.id === conv.id
                  const msgDate = new Date(conv.last_message_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        setActiveConv(conv)
                        setSearchParams({ conv: conv.id })
                      }}
                      className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                        {participant?.avatar_url ? (
                          <img
                            src={participant.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (participant?.display_name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-gray-900 truncate font-heading">
                            {participant?.display_name || 'Student'}
                          </h4>
                          <span className="text-[10px] font-mono text-gray-500">
                            {msgDate}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {conv.last_message_text || 'Conversation opened'}
                        </p>
                      </div>

                      {!!(conv as any).unread_count && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                          {(conv as any).unread_count}
                        </span>
                      )}
                    </button>
                  )
                })
              ) : (
                <div className="p-8 text-center space-y-2">
                  <User className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs text-gray-500">No conversations found.</p>
                  <Link to="/community/teammates">
                    <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                      Find teammates to connect
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Chat Thread */}
          <div
            className={`flex-1 flex flex-col bg-gray-50/60 ${
              !activeConv ? 'hidden md:flex' : 'flex'
            }`}
          >
            {activeConv ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveConv(null)}
                      className="md:hidden p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0">
                      {otherParticipant?.avatar_url ? (
                        <img
                          src={otherParticipant.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (otherParticipant?.display_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-gray-900 font-heading">
                        {otherParticipant?.display_name || 'Participant'}
                      </h3>
                      {otherParticipant?.id && (
                        <Link
                          to={`/profile/${otherParticipant.id}`}
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-mono"
                        >
                          View public profile
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBlockUser}
                      disabled={isBlocked}
                      className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={isBlocked ? 'Participant Blocked' : 'Block User'}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(true)}
                      className="p-2 rounded-xl text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Report Conversation"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Blocked State Notice */}
                {isBlocked && (
                  <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Messaging is blocked between you and this participant. You cannot send or receive new messages.
                    </span>
                  </div>
                )}

                {/* Messages View */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {threadError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {threadError}
                    </div>
                  )}
                  {loadingMessages ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono">
                      Loading messages…
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id
                      const timeStr = new Date(msg.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                      })
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] sm:max-w-md p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs shadow-2xs'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] font-mono text-gray-500">
                            <span>{timeStr}</span>
                            {isMe && (
                              <span>
                                {msg.is_read ? (
                                  <CheckCheck className="w-3 h-3 text-blue-600" />
                                ) : (
                                  <Check className="w-3 h-3 text-gray-400" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <Sparkles className="w-8 h-8 text-gray-300" />
                      <p className="text-sm font-semibold text-gray-900">Start the conversation</p>
                      <p className="text-xs text-gray-500 max-w-xs">
                        Say hello to coordinate for campus hackathons, squad invites, or club activities.
                      </p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {sendError && (
                  <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs">
                    {sendError}
                  </div>
                )}

                {/* Chat Input */}
                <form
                  onSubmit={handleSend}
                  className="p-3 sm:p-4 border-t border-gray-200 bg-white flex items-end gap-2"
                >
                  <textarea
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    disabled={isBlocked || sending}
                    placeholder={
                      isBlocked
                        ? 'Messaging disabled due to active block'
                        : 'Type a message… (Enter to send)'
                    }
                    maxLength={2000}
                    className="flex-1 max-h-32 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 resize-none disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!text.trim() || sending || isBlocked}
                    className="h-11 w-11 p-0 rounded-2xl flex items-center justify-center flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <MessageSquare className="w-12 h-12 text-gray-300" />
                <h3 className="text-base font-bold text-gray-900 font-heading">Your Messages</h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  Select a chat on the left or connect with a peer from the Teammate Discovery board to start collaborating.
                </p>
                <Link to="/community/teammates">
                  <Button variant="outline" size="sm" className="text-xs">
                    Find Campus Teammates
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Community Report Modal */}
      {otherParticipant?.id && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="user"
          targetId={otherParticipant.id}
          targetLabel={otherParticipant.display_name}
        />
      )}
    </PageShell>
  )
}
