import { PageShell } from '@/components/layout/PageShell'
import { Card, Badge } from '@/components/ui'
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_SUPPORT_MAILTO } from '@/lib/brandConfig'
import { ShieldCheck } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-left">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="brand">Platform Governance</Badge>
          <span className="text-xs text-gray-500 font-medium">Effective: October 2026</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold font-display text-gray-900 tracking-tight mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-8 max-w-2xl leading-relaxed">
          Learn how FestFlow collects, uses, and safeguards attendee and club organizer data across campus events.
        </p>

        <Card variant="default" className="p-6 sm:p-8 space-y-6 text-sm text-gray-600 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-display font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={18} />
              1. Information We Collect
            </h2>
            <p>
              When you use FestFlow as a student or campus club representative, we collect information necessary to issue tickets, facilitate communications, and confirm event registrations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-gray-600">
              <li><strong className="text-gray-900">Account Credentials:</strong> Full name, institutional or personal email address, and authentication identifiers managed securely via Supabase Auth.</li>
              <li><strong className="text-gray-900">Club Profile Data:</strong> Club name, representative name, contact details, description, and event metadata.</li>
              <li><strong className="text-gray-900">Event Registration Data:</strong> Event selections, unique ticket codes, entry timestamps, and registration statuses.</li>
              <li><strong className="text-gray-900">Payment Proofs:</strong> UPI transaction reference (UTR) numbers and optional receipt screenshots submitted solely for manual club organizer verification.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              2. How Information is Used
            </h2>
            <p>
              Collected information is strictly used for event discovery, digital pass confirmation, organizer coordination, analytics, and transactional notifications (such as registration approvals and payment receipts). We do not sell attendee information to third-party advertisers.
            </p>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              3. Data Security & Storage
            </h2>
            <p>
              All database records and storage buckets are secured through PostgreSQL Row Level Security (RLS) policies. Sensitive credentials and server secrets are never exposed on client devices. Payment screenshot uploads are restricted to the submitting student and the verified club organizer.
            </p>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              4. Contact & Inquiries
            </h2>
            <p>
              For privacy inquiries, data deletion requests, or institutional compliance audits, please contact the FestFlow team at{' '}
              <a href={OFFICIAL_SUPPORT_MAILTO} className="text-blue-600 hover:underline font-medium">
                {OFFICIAL_CONTACT_EMAIL}
              </a>.
            </p>
          </section>
        </Card>
      </div>
    </PageShell>
  )
}
