import { Users, Globe, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EventSpeaker, SpeakerRole } from '@/types'

interface EventSpeakersSectionProps {
  speakers: EventSpeaker[]
}

export function EventSpeakersSection({ speakers }: EventSpeakersSectionProps) {
  if (!speakers || speakers.length === 0) return null

  const getRoleBadge = (role: SpeakerRole) => {
    switch (role) {
      case 'keynote_speaker':
        return <Badge variant="cyan">Keynote Speaker</Badge>
      case 'judge':
        return <Badge variant="pink">Distinguished Judge</Badge>
      case 'mentor':
        return <Badge variant="purple">Technical Mentor</Badge>
      case 'host':
        return <Badge variant="amber">Master of Ceremonies</Badge>
      case 'panelist':
        return <Badge variant="blue">Panelist</Badge>
      default:
        return <Badge variant="default">Speaker</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            Distinguished Speakers & Judges
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Industry professionals, faculty mentors, and competition evaluators
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {speakers.map((spk) => (
          <div
            key={spk.id}
            className="p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all flex flex-col justify-between gap-3 text-left shadow-xs group"
          >
            <div>
              {/* Avatar & Role */}
              <div className="flex items-start justify-between gap-3 mb-3">
                {spk.avatar_url ? (
                  <img
                    src={spk.avatar_url}
                    alt={spk.name}
                    className="w-14 h-14 rounded-xl object-cover border border-gray-200 group-hover:border-blue-300 transition-colors"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 font-extrabold text-lg border border-blue-200">
                    {spk.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {getRoleBadge(spk.role)}
              </div>

              {/* Name & Title */}
              <h3 className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                {spk.name}
              </h3>
              {(spk.designation || spk.organization) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {spk.designation}
                  {spk.designation && spk.organization ? ' • ' : ''}
                  {spk.organization}
                </p>
              )}

              {/* Bio snippet */}
              {spk.bio && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-3 leading-relaxed font-sans">
                  {spk.bio}
                </p>
              )}
            </div>

            {/* Social Links */}
            {spk.social_links && Object.keys(spk.social_links).length > 0 && (
              <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100">
                {spk.social_links.linkedin && (
                  <a
                    href={spk.social_links.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors flex items-center gap-1 text-[11px]"
                    aria-label={`${spk.name} LinkedIn`}
                  >
                    <ExternalLink size={12} />
                    <span>LinkedIn</span>
                  </a>
                )}
                {spk.social_links.twitter && (
                  <a
                    href={spk.social_links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-sky-50 text-gray-600 hover:text-sky-700 transition-colors flex items-center gap-1 text-[11px]"
                    aria-label={`${spk.name} Twitter`}
                  >
                    <ExternalLink size={12} />
                    <span>X</span>
                  </a>
                )}
                {spk.social_links.github && (
                  <a
                    href={spk.social_links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1 text-[11px]"
                    aria-label={`${spk.name} GitHub`}
                  >
                    <ExternalLink size={12} />
                    <span>GitHub</span>
                  </a>
                )}
                {spk.social_links.website && (
                  <a
                    href={spk.social_links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors flex items-center gap-1 text-[11px]"
                    aria-label={`${spk.name} Website`}
                  >
                    <Globe size={12} />
                    <span>Portfolio</span>
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
