import { useState } from 'react'
import { Trophy, Medal, Award, Search, Users, User } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EventLeaderboardEntry, LeaderboardSubmissionStatus } from '@/types'

interface EventLeaderboardSectionProps {
  entries: EventLeaderboardEntry[]
  title?: string
  isOrganizer?: boolean
}

export function EventLeaderboardSection({
  entries,
  title = 'Competition Leaderboard & Standings',
}: EventLeaderboardSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')

  if (!entries || entries.length === 0) return null

  // Sort by rank ascending, then score descending
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank
    if (a.rank) return -1
    if (b.rank) return 1
    return b.score - a.score
  })

  // Filter based on search query
  const filteredEntries = sortedEntries.filter((e) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      e.participant_name.toLowerCase().includes(q) ||
      (e.team_name && e.team_name.toLowerCase().includes(q))
    )
  })

  // Top 3 Podium
  const top1 = sortedEntries[0]
  const top2 = sortedEntries[1]
  const top3 = sortedEntries[2]

  const getStatusBadge = (status: LeaderboardSubmissionStatus) => {
    switch (status) {
      case 'finalist':
        return <Badge variant="pink">Finalist</Badge>
      case 'evaluated':
        return <Badge variant="cyan">Evaluated</Badge>
      case 'under_review':
        return <Badge variant="amber">Under Review</Badge>
      case 'disqualified':
        return <Badge variant="danger">Disqualified</Badge>
      default:
        return <Badge variant="default">Submitted</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            {title}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time participant evaluation scores and final standings
          </p>
        </div>

        {/* Search Filter */}
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team or attendee…"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          />
        </div>
      </div>

      {/* ── Top 3 Podium Cards ────────────────────────────────────────────── */}
      {sortedEntries.length >= 2 && !searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
          {/* 2nd Place */}
          {top2 && (
            <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex flex-col items-center text-center order-2 sm:order-1 relative">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center mb-2">
                <Medal size={20} />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold">
                2nd Place
              </span>
              <strong className="text-gray-900 text-sm font-semibold truncate w-full mt-1">
                {top2.team_name || top2.participant_name}
              </strong>
              {top2.team_name && (
                <span className="text-[10px] text-gray-500 truncate">{top2.participant_name}</span>
              )}
              <span className="text-lg font-extrabold text-gray-900 font-mono mt-2">
                {top2.score} pts
              </span>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {top1 && (
            <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-col items-center text-center order-1 sm:order-2 relative shadow-sm sm:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center mb-2">
                <Trophy size={24} />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-extrabold">
                Winner · Rank 1
              </span>
              <strong className="text-gray-900 text-base font-bold truncate w-full mt-1">
                {top1.team_name || top1.participant_name}
              </strong>
              {top1.team_name && (
                <span className="text-[11px] text-gray-600 truncate">{top1.participant_name}</span>
              )}
              <span className="text-2xl font-black text-amber-600 font-mono mt-2">
                {top1.score} pts
              </span>
            </div>
          )}

          {/* 3rd Place */}
          {top3 && (
            <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex flex-col items-center text-center order-3 relative">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center mb-2">
                <Award size={20} />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-orange-700 font-bold">
                3rd Place
              </span>
              <strong className="text-gray-900 text-sm font-semibold truncate w-full mt-1">
                {top3.team_name || top3.participant_name}
              </strong>
              {top3.team_name && (
                <span className="text-[10px] text-gray-500 truncate">{top3.participant_name}</span>
              )}
              <span className="text-lg font-extrabold text-gray-900 font-mono mt-2">
                {top3.score} pts
              </span>
            </div>
          )}
        </div>
      )}

      {/* Standings Table */}
      <div className="rounded-xl bg-white border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-[11px]">
                <th className="py-3 px-4 font-semibold w-16">Rank</th>
                <th className="py-3 px-4 font-semibold">Participant / Squad</th>
                <th className="py-3 px-4 font-semibold">Evaluation Status</th>
                <th className="py-3 px-4 font-semibold text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEntries.map((entry, index) => {
                const rankNum = entry.rank || index + 1
                return (
                  <tr key={entry.id || index} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold">
                      {rankNum === 1 ? (
                        <span className="text-amber-600">#1</span>
                      ) : rankNum === 2 ? (
                        <span className="text-slate-600">#2</span>
                      ) : rankNum === 3 ? (
                        <span className="text-orange-600">#3</span>
                      ) : (
                        <span className="text-gray-500">#{rankNum}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {entry.team_name ? (
                          <Users size={14} className="text-blue-600 shrink-0" />
                        ) : (
                          <User size={14} className="text-gray-400 shrink-0" />
                        )}
                        <div>
                          <strong className="text-gray-900 block font-medium">
                            {entry.team_name || entry.participant_name}
                          </strong>
                          {entry.team_name && (
                            <span className="text-[10px] text-gray-500">
                              Lead: {entry.participant_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(entry.submission_status)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 text-sm">
                      {entry.score}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

