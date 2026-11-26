import { PageShell } from '@/components/layout/PageShell'
import { Card, Badge, Button, Input, Textarea } from '@/components/ui'
import { Mail, MessageSquare, HelpCircle, Send, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_SUPPORT_MAILTO, buildOfficialMailto } from '@/lib/brandConfig'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const inquirySubject = `FestFlow Inquiry from ${name.trim()}`
  const inquiryBody = `${message.trim()}\n\n---\nSender: ${name.trim()}\nReply-To: ${email.trim()}`
  const inquiryMailtoUrl = buildOfficialMailto(inquirySubject, inquiryBody)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    window.location.href = inquiryMailtoUrl
    setSubmitted(true)
  }

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-left">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="brand">Support & Inquiries</Badge>
          <span className="text-xs text-gray-500 font-medium">Campus Help Desk</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold font-display text-gray-900 tracking-tight mb-3">
          Get in Touch
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-8 max-w-xl leading-relaxed">
          Have questions about onboarding your college club, attendee ticketing, or payment verification? Our team is here to assist.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Card variant="default" className="p-5 flex flex-col items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Email Support</h3>
              <p className="text-xs text-gray-500 mt-1">General inquiries & organizer assistance</p>
              <a href={OFFICIAL_SUPPORT_MAILTO} className="text-xs text-blue-600 hover:underline mt-2 inline-block font-medium">
                {OFFICIAL_CONTACT_EMAIL}
              </a>
            </div>
          </Card>

          <Card variant="default" className="p-5 flex flex-col items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Club Onboarding</h3>
              <p className="text-xs text-gray-500 mt-1">Direct support for student councils & clubs</p>
              <a href={OFFICIAL_SUPPORT_MAILTO} className="text-xs text-blue-600 hover:underline mt-2 inline-block font-medium">
                {OFFICIAL_CONTACT_EMAIL}
              </a>
            </div>
          </Card>

          <Card variant="default" className="p-5 flex flex-col items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Help Resources</h3>
              <p className="text-xs text-gray-500 mt-1">Platform guides, setup & troubleshooting</p>
              <span className="text-xs text-gray-700 mt-2 inline-block font-mono font-medium">
                festflow.online/contact
              </span>
            </div>
          </Card>
        </div>

        <Card variant="default" className="p-6 sm:p-8">
          <h2 className="text-lg font-display font-bold text-gray-900 mb-1.5">Send Us a Direct Message</h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            We typically respond within one business day during campus operating hours.
          </p>

          {submitted ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
              <h3 className="font-semibold text-sm text-emerald-950">Email Draft Prepared</h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
                Thank you, {name}! Your email client has been prepared to dispatch your message to <span className="font-semibold text-emerald-950">{OFFICIAL_CONTACT_EMAIL}</span>.
              </p>
              <div className="pt-2">
                <a
                  href={inquiryMailtoUrl}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Click here to re-open mail client
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Your Name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priyanshu Sharma"
                />
                <Input
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@campus.edu"
                />
              </div>

              <Textarea
                label="Message or Query"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help your club or event?"
              />

              <Button type="submit" variant="primary" leftIcon={<Send size={15} />}>
                Send Inquiry
              </Button>
            </form>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
