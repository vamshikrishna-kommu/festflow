import { PageShell } from '@/components/layout/PageShell'
import { Card, Badge } from '@/components/ui'
import { ShieldCheck } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="cyan">Platform Governance</Badge>
          <span className="text-xs text-[var(--color-text-muted)]">Effective: October 2026</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--color-text-primary)] mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 max-w-2xl">
          Learn how FestFlow collects, uses, and safeguards attendee and club organizer data across campus events.
        </p>

        <Card className="p-6 sm:p-8 space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <ShieldCheck className="text-[var(--color-brand-cyan)]" size={18} />
              1. Information We Collect
            </h2>
            <p>
              When you use FestFlow as a student or campus club representative, we collect information necessary to issue tickets, facilitate communications, and confirm event registrations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Account Credentials:</strong> Full name, institutional or personal email address, and authentication identifiers managed securely via Supabase Auth.</li>
              <li><strong>Club Profile Data:</strong> Club name, representative name, contact details, description, and event metadata.</li>
              <li><strong>Event Registration Data:</strong> Event selections, unique ticket codes, entry timestamps, and registration statuses.</li>
              <li><strong>Payment Proofs:</strong> UPI transaction reference (UTR) numbers and optional receipt screenshots submitted solely for manual club organizer verification.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              2. How Information is Used
            </h2>
            <p>
              Collected information is strictly used for event discovery, ticket generation, door check-in, organizer analytics, and transactional notifications (such as registration approvals and payment receipts). We do not sell attendee information to third-party advertisers.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              3. Data Security & Storage
            </h2>
            <p>
              All database records and storage buckets are secured through PostgreSQL Row Level Security (RLS) policies. Sensitive credentials and server secrets are never exposed on client devices. Payment screenshot uploads are restricted to the submitting student and the verified club organizer.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              4. Contact & Inquiries
            </h2>
            <p>
              For privacy inquiries, data deletion requests, or institutional compliance audits, please contact the FestFlow team at{' '}
              <a href="mailto:privacy@festflow.com" className="text-[var(--color-brand-cyan)] underline">
                privacy@festflow.com
              </a>.
            </p>
          </section>
        </Card>
      </div>
    </PageShell>
  )
}
