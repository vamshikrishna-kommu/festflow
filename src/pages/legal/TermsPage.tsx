import { PageShell } from '@/components/layout/PageShell'
import { Card, Badge } from '@/components/ui'
import { FileText } from 'lucide-react'

export default function TermsPage() {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="brand">Terms of Agreement</Badge>
          <span className="text-xs text-[var(--color-text-muted)]">Effective: October 2026</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-white mb-4">
          Terms of Service
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 max-w-2xl">
          Guidelines and responsibilities governing student event registrations, ticket issuance, and club event administration.
        </p>

        <Card className="p-6 sm:p-8 space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed border-white/10 bg-[#0E0E12]/80 backdrop-blur-md">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="text-[#18CFFC]" size={18} />
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using FestFlow, you agree to comply with and be bound by these terms. If you are registering on behalf of a college club or organization, you represent that you possess authority to act for that entity.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              2. Free Platform & Event Publishing
            </h2>
            <p>
              FestFlow is free to use for college club organizers and student attendees. FestFlow does not charge platform subscription fees or transaction commissions. Club representatives are solely responsible for their event content, schedules, ticket pricing accuracy, venue safety, and fulfillment. Organizers must accurately verify student payment transactions before issuing entry-valid tickets.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              3. Ticketing, Direct UPI & Entry
            </h2>
            <p>
              FestFlow facilitates direct peer-to-club manual UPI transactions. Tickets are issued as digital passes with unique QR validation codes. FestFlow is not a payment gateway and does not hold user funds in escrow; 100% of event proceeds transfer directly to the hosting club. Refunds and event cancellations are governed by the hosting club's published event policy.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              4. Code of Conduct
            </h2>
            <p>
              Users agree not to disrupt platform operations, submit counterfeit payment reference numbers, or attempt unauthorized entry with voided or cancelled passes. Violation may result in account termination.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-[oklch(100%_0_0_/_0.06)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              5. Contact
            </h2>
            <p>
              Questions regarding these terms should be directed to{' '}
              <a href="mailto:terms@festflow.com" className="text-[#18CFFC] hover:text-[#18CFFC] underline transition-colors">
                terms@festflow.com
              </a>.
            </p>
          </section>
        </Card>
      </div>
    </PageShell>
  )
}
