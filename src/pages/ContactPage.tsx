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
    const mailtoUrl = `mailto:support@festflow.com?subject=${encodeURIComponent(
      `FestFlow Inquiry from ${name.trim()}`
    )}&body=${encodeURIComponent(
      `${message.trim()}\n\n---\nSender: ${name.trim()}\nReply-To: ${email.trim()}`
    )}`
    window.location.href = mailtoUrl
    setSubmitted(true)
  }

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="brand">Support & Inquiries</Badge>
          <span className="text-xs text-[var(--color-text-muted)]">Campus Help Desk</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-white mb-4">
          Get in Touch
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 max-w-xl">
          Have questions about onboarding your college club, attendee ticketing, or payment verification? Our team is here to assist.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-5 flex flex-col items-start gap-3 border-white/10 hover:border-[#18CFFC]/40 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-[#18CFFC]/15 text-[#18CFFC] flex items-center justify-center border border-[#18CFFC]/20">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Email Support</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">General inquiries & organizer assistance</p>
              <a href="mailto:support@festflow.com" className="text-xs text-[#18CFFC] hover:text-[#18CFFC] mt-2 inline-block font-medium transition-colors">
                support@festflow.com
              </a>
            </div>
          </Card>

          <Card className="p-5 flex flex-col items-start gap-3 border-white/10 hover:border-[#18CFFC]/40 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-[#18CFFC]/15 text-[#18CFFC] flex items-center justify-center border border-[#18CFFC]/20">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Club Onboarding</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Direct support for student councils & clubs</p>
              <a href="mailto:clubs@festflow.com" className="text-xs text-[#18CFFC] hover:text-[#18CFFC] mt-2 inline-block font-medium transition-colors">
                clubs@festflow.com
              </a>
            </div>
          </Card>

          <Card className="p-5 flex flex-col items-start gap-3 border-white/10 hover:border-amber-500/40 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Documentation</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Setup guides, Edge Functions & migrations</p>
              <span className="text-xs text-amber-400 mt-2 inline-block font-medium">
                docs.festflow.com (Pre-launch)
              </span>
            </div>
          </Card>
        </div>

        <Card className="p-6 sm:p-8 border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">Send Us a Direct Message</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-6">
            We typically respond within one business day during campus operating hours.
          </p>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h3 className="font-bold text-sm text-emerald-200">Email Draft Prepared</h3>
              <p className="text-xs text-emerald-300/80 max-w-md mx-auto leading-relaxed">
                Thank you, {name}! Your email client has been prepared to dispatch your message to <span className="font-semibold text-white">support@festflow.com</span>. If your mail app did not open automatically, you can send it directly.
              </p>
              <div className="pt-2">
                <a
                  href={`mailto:support@festflow.com?subject=${encodeURIComponent(`FestFlow Inquiry from ${name.trim()}`)}&body=${encodeURIComponent(`${message.trim()}\n\n---\nSender: ${name.trim()}\nReply-To: ${email.trim()}`)}`}
                  className="text-xs font-semibold text-[#18CFFC] hover:text-[#18CFFC] underline"
                >
                  Click here to re-open mail client
                </a>
              </div>
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] resize-none"
                />
              </div>

              <Button type="submit" variant="primary" className="gap-2 bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:brightness-110 text-white font-semibold shadow-[0_4px_16px_rgba(24,207,252,0.3)]">
                <Send size={15} /> Send Inquiry
              </Button>
            </form>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
