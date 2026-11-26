import { useRef } from 'react'
import { Link } from 'react-router'
import {
  Code,
  Music,
  Trophy,
  BookOpen,
  Gamepad2,
  Mic,
  ArrowRight,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { useStaggerReveal } from '@/lib/motion'

const CATEGORIES = [
  {
    id: 'tech',
    title: 'Technical & Hackathons',
    description: 'Code sprints, robotics expos, AI symposiums, and 36-hour buildathons.',
    icon: Code,
    tag: 'Tech Chapters',
  },
  {
    id: 'cultural',
    title: 'Cultural & Arts',
    description: 'Dance battles, live music nights, fashion showcases, and theater fests.',
    icon: Music,
    tag: 'Arts Societies',
  },
  {
    id: 'sports',
    title: 'Sports & Tournaments',
    description: 'Inter-college cricket, football leagues, basketball face-offs, and track meets.',
    icon: Trophy,
    tag: 'Sports Councils',
  },
  {
    id: 'workshop',
    title: 'Workshops & Bootcamps',
    description: 'Hands-on developer workshops, design masterclasses, and career panels.',
    icon: BookOpen,
    tag: 'Academic Forums',
  },
  {
    id: 'gaming',
    title: 'Gaming & Esports',
    description: 'LAN tournaments, Valorant showdowns, console championships, and game jams.',
    icon: Gamepad2,
    tag: 'Esports Clubs',
  },
  {
    id: 'literary',
    title: 'Literary & Debates',
    description: 'Parliamentary debates, MUNs, quiz bowls, creative writing, and poetry slams.',
    icon: Mic,
    tag: 'Literary Clubs',
  },
]

export function CategoryShowcaseSection() {
  const gridRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(gridRef, '.category-card', { y: 16, stagger: 0.05 })

  return (
    <section
      id="categories"
      aria-labelledby="categories-heading"
      className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div className="mb-10 sm:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-left">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200 mb-3">
            Event Categories
          </span>
          <h2
            id="categories-heading"
            className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight"
          >
            Explore campus life by interest.
          </h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            From high-stakes hackathons to open-mic poetry, discover everything happening across your university.
          </p>
        </div>

        <Link
          to="/discover"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0"
        >
          <span>View all categories</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map(({ id, title, description, icon: Icon, tag }) => (
          <Link key={id} to={`/discover?category=${id}`} className="group block h-full">
            <Card
              variant="interactive"
              className="category-card p-6 h-full flex flex-col justify-between text-left"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </div>
                  <span className="font-mono text-[11px] font-medium text-gray-500">
                    {tag}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-base text-gray-900 group-hover:text-blue-600 transition-colors mb-1.5">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="pt-4 mt-5 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                <span>Browse {title}</span>
                <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center sm:hidden">
        <Link
          to="/discover"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <span>View all event categories</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  )
}
