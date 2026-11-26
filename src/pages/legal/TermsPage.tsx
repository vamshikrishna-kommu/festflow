import { PageShell } from '@/components/layout/PageShell'
import { Card, Badge } from '@/components/ui'
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_SUPPORT_MAILTO } from '@/lib/brandConfig'
import { FileText } from 'lucide-react'

export default function TermsPage() {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-left">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="brand">Terms of Agreement</Badge>
          <span className="text-xs text-gray-500 font-medium">Effective: October 2026</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold font-display text-gray-900 tracking-tight mb-3">
          Terms of Service
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-8 max-w-2xl leading-relaxed">
          Guidelines and responsibilities governing student event registrations, ticket issuance, and club event administration.
        </p>

        <Card variant="default" className="p-6 sm:p-8 space-y-6 text-sm text-gray-600 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-display font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={18} />
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using FestFlow, you agree to comply with and be bound by these terms. If you are registering on behalf of a college club or organization, you represent that you possess authority to act for that entity.
            </p>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              2. Free Platform & Event Publishing
            </h2>
            <p>
              FestFlow is free to use for college club organizers and student attendees. FestFlow does not charge platform subscription fees or transaction commissions. Club representatives are solely responsible for their event content, schedules, ticket pricing accuracy, venue safety, and fulfillment. Organizers must accurately verify student payment transactions before issuing entry-valid tickets.
            </p>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              3. Ticketing, Direct UPI & Entry
            </h2>
            <p>
              FestFlow facilitates direct peer-to-club manual UPI transactions. Registrations are confirmed with verifiable digital passes. FestFlow is not a payment gateway and does not hold user funds in escrow; 100% of event proceeds transfer directly to the hosting club. Refunds and event cancellations are governed by the hosting club&apos;s published event policy.
            </p>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              4. Code of Conduct
            </h2>
            <p>
              Users agree not to disrupt platform operations, submit counterfeit payment reference numbers, or misuse cancelled or voided registration passes. Violation may result in account termination.
            </p>
          </section>

          <section className="space-y-3 pt-5 border-t border-gray-100">
            <h2 className="text-lg font-display font-bold text-gray-900">
              5. Contact
            </h2>
            <p>
              Questions regarding these terms should be directed to{' '}
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
