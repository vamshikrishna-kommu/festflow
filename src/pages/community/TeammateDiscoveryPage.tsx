import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import {
  Users,
  Search,
  UserPlus,
  Check,
  X,
  MessageSquare,
  Settings,
} from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { useDebounce } from '@/hooks/useDebounce'
import type {
  TeammateProfileRecord,
  TeammateRequestRecord,
  TeammateAvailability,
} from '@/types'
import {
  getTeammateDiscoveryProfile,
  saveTeammateDiscoveryProfile,
  searchTeammates,
  sendTeammateRequest,
  respondToTeammateRequest,
  withdrawTeammateRequest,
  getStudentTeammateRequests,
} from '@/lib/teammates'
import { listPublishedEvents, isEventCompleted } from '@/lib/events'

const POPULAR_SKILLS = [
  'React',
  'TypeScript',
  'Python',
  'AI / ML',
  'UI / UX Design',
  'Node.js',
  'Flutter',
  'Hardware / IoT',
  'Cybersecurity',
  'Public Speaking',
  'Video Editing',
  'Pitching',
]

export default function TeammateDiscoveryPage() {
  const { user } = useAuth()
  const studentId = user?.id || ''

  const [activeTab, setActiveTab] = useState<'browse' | 'requests' | 'my_profile'>('browse')
  const [candidates, setCandidates] = useState<TeammateProfileRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [availabilityFilter, setAvailabilityFilter] = useState<TeammateAvailability | ''>('')
  const searchReqId = useRef(0)

  // Teammate Requests
  const [incomingRequests, setIncomingRequests] = useState<TeammateRequestRecord[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<TeammateRequestRecord[]>([])

  // Send Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<TeammateProfileRecord | null>(null)
  const [requestMessage, setRequestMessage] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [isSendingRequest, setIsSendingRequest] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null)

  // My Discovery Profile Editor State
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [mySkills, setMySkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [availability, setAvailability] = useState<TeammateAvailability>('actively_looking')
  const [isOptedIn, setIsOptedIn] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [saveNotice, setSaveNotice] = useState<{ message: string; isError?: boolean } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Upcoming events for selection
  const [availableEvents, setAvailableEvents] = useState<any[]>([])

  // Initial load: Profile, Events, Requests (runs once or when studentId changes)
  useEffect(() => {
    async function loadInitialContext() {
      const eventsRes = await listPublishedEvents({ limit: 15 })
      const activeEvents = (eventsRes.events || []).filter((e) => !isEventCompleted(e))
      setAvailableEvents(activeEvents)

      if (studentId) {
        const [myProfileRes, requestsRes] = await Promise.all([
          getTeammateDiscoveryProfile(studentId),
          getStudentTeammateRequests(studentId),
        ])

        if (myProfileRes.profile) {
          setHeadline(myProfileRes.profile.headline || '')
          setBio(myProfileRes.profile.bio || '')
          setMySkills(myProfileRes.profile.skills || [])
          setLookingFor(myProfileRes.profile.looking_for || '')
          setAvailability(myProfileRes.profile.availability || 'actively_looking')
          setIsOptedIn(myProfileRes.profile.is_opted_in !== false)
        }

        setIncomingRequests(requestsRes.received)
        setOutgoingRequests(requestsRes.sent)
      }
    }

    loadInitialContext()
  }, [studentId])

  // Filter & Search Candidates: Debounced without refetching static events
  useEffect(() => {
    async function fetchFilteredCandidates() {
      const currentId = ++searchReqId.current
      setLoading(true)

      const searchRes = await searchTeammates({
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        query: debouncedSearchQuery,
        availability: availabilityFilter || undefined,
        viewerId: studentId,
      })

      if (currentId === searchReqId.current) {
        setCandidates(searchRes.candidates)
        setLoading(false)
      }
    }

    fetchFilteredCandidates()
  }, [studentId, selectedSkills, debouncedSearchQuery, availabilityFilter])

  const handleToggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  const handleAddMySkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = skillInput.trim()
    if (trimmed && !mySkills.includes(trimmed)) {
      setMySkills((prev) => [...prev, trimmed])
      setSkillInput('')
    }
  }

  const handleRemoveMySkill = (skill: string) => {
    setMySkills((prev) => prev.filter((s) => s !== skill))
  }

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId) return
    setIsSavingProfile(true)
    setSaveNotice(null)

    const res = await saveTeammateDiscoveryProfile({
      studentId,
      headline,
      bio,
      skills: mySkills,
      lookingFor,
      availability,
      isOptedIn,
    })

    setIsSavingProfile(false)
    if (res.success) {
      setSaveNotice({ message: 'Teammate discovery profile saved successfully!' })
      setTimeout(() => setSaveNotice(null), 3000)
    } else {
      setSaveNotice({ message: res.message || 'Unable to save teammate profile.', isError: true })
    }
  }

  const handleOpenRequestModal = (candidate: TeammateProfileRecord) => {
    setSelectedCandidate(candidate)
    setRequestMessage(
      `Hey ${candidate.student?.display_name || 'there'}! I saw your profile on FestFlow and wanted to connect as teammates for upcoming hackathons/events.`
    )
    setRequestError(null)
    setRequestSuccess(null)
    setRequestModalOpen(true)
  }

  const handleSendRequest = async () => {
    if (!selectedCandidate || !studentId) return
    setIsSendingRequest(true)
    setRequestError(null)

    const res = await sendTeammateRequest({
      senderId: studentId,
      receiverId: selectedCandidate.student_id,
      eventId: selectedEventId || null,
      message: requestMessage.trim(),
    })

    setIsSendingRequest(false)
    if (res.success) {
      setRequestSuccess('Teammate request sent successfully!')
      setTimeout(() => {
        setRequestModalOpen(false)
        setSelectedCandidate(null)
      }, 1500)
    } else {
      setRequestError(res.message || 'Failed to dispatch teammate request.')
    }
  }

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    setActionError(null)
    const res = await respondToTeammateRequest(requestId, studentId, status)
    if (res.success) {
      setIncomingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      )
    } else {
      setActionError(res.message || 'Failed to update teammate request.')
    }
  }

  const handleWithdraw = async (requestId: string) => {
    const res = await withdrawTeammateRequest(requestId, studentId)
    if (res.success) {
      setOutgoingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'withdrawn' } : r))
      )
    }
  }

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left space-y-8">
        {/* Header Hero */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-blue-600 tracking-wider font-bold mb-1">
              <Users size={14} /> Squad Matchmaking
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-gray-900">
              Find Teammates & Hackathon Partners
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
              Connect with talented developers, designers, hardware builders, and speakers on campus.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'browse'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Browse Teammates
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'requests'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Requests
              {incomingRequests.filter((r) => r.status === 'pending').length > 0 && (
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  activeTab === 'requests' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                }`}>
                  {incomingRequests.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my_profile')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'my_profile'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings size={13} /> My Matchmaking Status
            </button>
          </div>
        </div>

        {/* ── TAB 1: BROWSE TEAMMATES ────────────────────────────────────────── */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search & Skill Filter Bar */}
            <div className="space-y-3 p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by skill, name, or headline..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>

                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                >
                  <option value="">All Availability</option>
                  <option value="actively_looking">Actively Looking</option>
                  <option value="open_to_offers">Open to Offers</option>
                </select>
              </div>

              {/* Skill Pill Selector */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2">
                <span className="text-[11px] font-mono text-gray-500 mr-1">Filter Skills:</span>
                {POPULAR_SKILLS.map((skill) => {
                  const isSelected = selectedSkills.includes(skill)
                  return (
                    <button
                      key={skill}
                      onClick={() => handleToggleSkill(skill)}
                      className={`text-xs px-2.5 py-1 rounded-lg transition border ${
                        isSelected
                          ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Candidates Grid */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-4" />
                <p className="text-xs text-gray-500 font-mono">Discovering campus peers…</p>
              </div>
            ) : candidates.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-gray-200 shadow-xs">
                <Users size={36} className="text-gray-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900">No teammates matched this filter</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Try clearing skill filters or check back as more students opt into matchmaking.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map((cand) => {
                  return (
                    <div
                      key={cand.id}
                      className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 transition flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        {/* Header: Avatar, Name & Availability */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                              {cand.student?.avatar_url ? (
                                <img
                                  src={cand.student.avatar_url}
                                  alt={cand.student.display_name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                cand.student?.display_name?.charAt(0) || 'U'
                              )}
                            </div>
                            <div>
                              <Link
                                to={`/profile/${cand.student_id}`}
                                className="text-sm font-bold text-gray-900 hover:text-blue-600 transition"
                              >
                                {cand.student?.display_name || 'Campus Student'}
                              </Link>
                              <span className="text-[11px] text-gray-500 block line-clamp-1">
                                {cand.student_profile?.college_name || 'Campus Participant'}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                              cand.availability === 'actively_looking'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {cand.availability === 'actively_looking' ? 'Looking' : 'Open'}
                          </span>
                        </div>

                        {/* Headline & Bio */}
                        {cand.headline && (
                          <h4 className="text-xs font-semibold text-gray-800 line-clamp-2 mb-2">
                            {cand.headline}
                          </h4>
                        )}

                        {cand.looking_for && (
                          <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-700 mb-3">
                            <strong className="text-blue-600 font-mono">Looking for: </strong>
                            {cand.looking_for}
                          </div>
                        )}

                        {/* Skills */}
                        {cand.skills && cand.skills.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap my-2">
                            {cand.skills.slice(0, 5).map((sk) => (
                              <span
                                key={sk}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200"
                              >
                                {sk}
                              </span>
                            ))}
                            {cand.skills.length > 5 && (
                              <span className="text-[10px] font-mono text-gray-500">
                                +{cand.skills.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="mt-5 pt-3.5 border-t border-gray-200 flex items-center justify-between gap-2">
                        <Link
                          to={`/profile/${cand.student_id}`}
                          className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                        >
                          View Profile
                        </Link>

                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<UserPlus size={13} />}
                          onClick={() => handleOpenRequestModal(cand)}
                        >
                          Request Teammate
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: REQUESTS MANAGEMENT ────────────────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="space-y-8">
            {/* Incoming Requests */}
            <div>
              <h3 className="text-base font-bold font-['Syne'] text-gray-900 mb-3">
                Incoming Connection Requests ({incomingRequests.filter((r) => r.status === 'pending').length} Pending)
              </h3>
              {actionError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {actionError}
                </div>
              )}
              {incomingRequests.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-gray-200 text-xs text-gray-500 shadow-xs">
                  No incoming teammate requests at this time.
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {req.sender?.display_name || 'Student'}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                              req.status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : req.status === 'declined'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                          "{req.message}"
                        </p>
                        {req.event && (
                          <div className="text-[11px] text-blue-600">
                            Interested in teaming up for: <strong>{req.event.title}</strong>
                          </div>
                        )}
                      </div>

                      {req.status === 'pending' ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Check size={13} />}
                            onClick={() => handleRespond(req.id, 'accepted')}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<X size={13} />}
                            onClick={() => handleRespond(req.id, 'declined')}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : req.status === 'accepted' ? (
                        <Link to="/messages">
                          <Button variant="outline" size="sm" leftIcon={<MessageSquare size={13} />}>
                            Message Teammate
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div>
              <h3 className="text-base font-bold font-['Syne'] text-gray-900 mb-3">
                Outgoing Connection Requests ({outgoingRequests.length})
              </h3>
              {outgoingRequests.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-gray-200 text-xs text-gray-500 shadow-xs">
                  You haven't sent any teammate requests yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            Sent to: {req.receiver?.display_name || 'Participant'}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                              req.status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : req.status === 'withdrawn'
                                ? 'bg-gray-100 text-gray-600 border-gray-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          "{req.message}"
                        </p>
                      </div>

                      {req.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWithdraw(req.id)}
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: MY MATCHMAKING STATUS EDITOR ───────────────────────────── */}
        {activeTab === 'my_profile' && (
          <form onSubmit={handleSaveMyProfile} className="max-w-2xl space-y-5 p-6 rounded-3xl bg-white border border-gray-200 shadow-xs">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-bold font-['Syne'] text-gray-900">
                Matchmaking Discovery Settings
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure your public visibility so other students can discover and invite you to event teams.
              </p>
            </div>

            {/* Opt-in toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <span className="text-xs font-bold text-gray-900 block">Opt-in to Teammate Discovery</span>
                <span className="text-[11px] text-gray-600">
                  Allow other registered campus students to browse your skills and invite you.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isOptedIn}
                onChange={(e) => setIsOptedIn(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Headline / Specialization
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Full-Stack Developer & ML Enthusiast looking for Hackathon squad"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Current Availability
              </label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              >
                <option value="actively_looking">Actively Looking for Team</option>
                <option value="open_to_offers">Open to Opportunities</option>
                <option value="unavailable">Currently Unavailable / Squad Complete</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                What Teammates Are You Looking For?
              </label>
              <input
                type="text"
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                placeholder="e.g. Need a UI/UX designer and pitch deck presenter for upcoming IoT contest"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            {/* My Skills Selector */}
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Your Primary Skills
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleAddMySkill}
                  placeholder="Type skill and press Enter (e.g., React, Python, Figma)"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
                <Button variant="outline" size="sm" type="button" onClick={handleAddMySkill}>
                  Add Skill
                </Button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {mySkills.map((sk) => (
                  <span
                    key={sk}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {sk}
                    <button
                      type="button"
                      onClick={() => handleRemoveMySkill(sk)}
                      className="hover:text-blue-900"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {saveNotice && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  saveNotice.isError
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {saveNotice.message}
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSavingProfile}
            >
              Save Settings
            </Button>
          </form>
        )}

        {/* ── SEND REQUEST MODAL ─────────────────────────────────────────────── */}
        <Modal
          isOpen={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          size="md"
          title={`Invite ${selectedCandidate?.student?.display_name || 'Teammate'}`}
        >
          <ModalBody className="p-4 sm:p-6 space-y-4">
            <p className="text-xs text-gray-600">
              Send a personalized teammate request. Once accepted, you can coordinate on Discord/WhatsApp or directly share your official FestFlow squad code.
            </p>

            {availableEvents.length > 0 && (
              <div>
                <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                  Specific Campus Event (Optional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                >
                  <option value="">General Teammate Connection</option>
                  {availableEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Your Message
              </label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            {requestError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {requestError}
              </div>
            )}

            {requestSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                {requestSuccess}
              </div>
            )}
          </ModalBody>

          <ModalFooter className="flex items-center justify-end gap-2 p-4">
            <Button variant="outline" size="sm" onClick={() => setRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSendingRequest}
              disabled={!requestMessage.trim() || isSendingRequest}
              onClick={handleSendRequest}
            >
              Send Request
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
