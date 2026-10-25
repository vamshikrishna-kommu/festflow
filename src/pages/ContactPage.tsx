import { PageShell } from '@/components/layout/PageShell'
import { Card, Badge, Button } from '@/components/ui'
import { Mail, MessageSquare, HelpCircle, Send, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="cyan">Support & Inquiries</Badge>
          <span className="text-xs text-[var(--color-text-muted)]">Campus Help Desk</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--color-text-primary)] mb-4">
          Get in Touch
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 max-w-xl">
          Have questions about onboarding your college club, attendee ticketing, or payment verification? Our team is here to assist.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-5 flex flex-col items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)] flex items-center justify-center">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">Email Support</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">General inquiries & organizer assistance</p>
              <a href="mailto:support@festflow.com" className="text-xs text-[var(--color-brand-purple)] mt-2 inline-block font-medium">
                support@festflow.com
              </a>
            </div>
          </Card>

          <Card className="p-5 flex flex-col items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-cyan)]/10 text-[var(--color-brand-cyan)] flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">Club Onboarding</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Direct support for student councils & clubs</p>
              <a href="mailto:clubs@festflow.com" className="text-xs text-[var(--color-brand-cyan)] mt-2 inline-block font-medium">
                clubs@festflow.com
              </a>
            </div>
          </Card>

          <Card className="p-5 flex flex-col items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">Documentation</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Setup guides, Edge Functions & migrations</p>
              <span className="text-xs text-amber-400 mt-2 inline-block font-medium">
                docs.festflow.com (Pre-launch)
              </span>
            </div>
          </Card>
        </div>

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Send Us a Direct Message</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-6">
            We typically respond within one business day during campus operating hours.
          </p>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h3 className="font-bold text-sm text-emerald-200">Message Received</h3>
              <p className="text-xs text-emerald-300/80">
                Thank you, {name}! We will review your inquiry and follow up at {email}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priyanshu Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@campus.edu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Message or Query</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help your club or event?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)] resize-none"
                />
              </div>

              <Button type="submit" variant="primary" className="gap-2">
                <Send size={15} /> Send Inquiry
              </Button>
            </form>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
