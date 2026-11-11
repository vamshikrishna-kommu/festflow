import { PageShell } from '@/components/layout/PageShell'
import { SEOHead } from '@/components/seo/SEOHead'
import { CinematicLanding } from '@/components/cinematic/CinematicLanding'

export default function LandingPage() {
  return (
    <PageShell fullbleed>
      <SEOHead
        title="FestFlow — One Platform. Every Campus Event."
        description="The modern, cinematic event platform for university clubs and students. Discover campus hackathons, cultural fests, instant UPI verification, and confirmed digital entry passes."
        canonicalPath="/"
      />
      <CinematicLanding />
    </PageShell>
  )
}
