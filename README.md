# FestFlow — College Event Management SaaS

FestFlow is a modern, premium event management platform for college clubs and students. Clubs can register directly and manage events with zero institutional bureaucracy, while students discover campus happenings and claim digital entry passes.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Motion (motion/react v12), GSAP ScrollTrigger, Lucide Icons
- **Backend & Database:** Supabase Auth, PostgreSQL 15+ with Row Level Security (RLS), Supabase Storage
- **Transactional Delivery:** Supabase Edge Functions (Deno / TypeScript) + Resend REST API
- **Deployment Platform:** Static SPA on Vercel / Cloudflare Pages / Netlify

---

## Environment Variables & Configuration

### 1. Public Client Variables (Frontend `.env`)
These variables are bundled by Vite and exposed publicly in the browser. Store them in `.env`:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```
> **Security Rule:** Never put service-role keys, database passwords, or third-party email API keys in frontend `.env` files or variables prefixed with `VITE_`.

### 2. Server-Only Secrets (Supabase Edge Functions)
Configured strictly on Supabase servers via the CLI or Supabase Dashboard. Never placed in client code:
```bash
supabase secrets set RESEND_API_KEY="re_your_api_key_here"
supabase secrets set RESEND_FROM_EMAIL="FestFlow <events@yourdomain.com>"
```

### 3. Simulation Mode vs Production Safeguards
- **Development (`npm run dev`):** If Supabase credentials are not provided in `.env`, FestFlow activates local simulation mode. Developers can test workflows, view mock dashboards, submit dummy registrations, and test QR scans without connecting a live database.
- **Production (`import.meta.env.PROD`):** In a production build, FestFlow strictly enforces live database connectivity. Simulation mode is permanently blocked from authorizing payments, approving registrations, or granting QR check-in entry. If Supabase environment variables are missing on production, a prominent alert is displayed and all write operations require verified backend credentials.

---

## Database Migrations (001 – 043 Complete Suite)

Apply the SQL migration scripts in numerical sequence via the **Supabase Dashboard SQL Editor** or using the Supabase CLI (`supabase db push`):

1. **`001_auth_profiles.sql`**: Roles (`student`, `club_member`, `platform_admin`), `profiles`, `club_profiles`, `student_profiles`, auto-profile creation trigger, and RLS policies.
2. **`002_events.sql`**: Event lifecycle management, constraints, RLS, and `event-posters` storage bucket.
3. **`003_registrations.sql`**: Student registrations, unique ticket codes, atomic row-locked `register_for_event()` RPC, and cancellation logic.
4. **`004_payments.sql`**: Manual UPI payment workflows, UTR reference validation, `payment_submissions`, `club_payment_settings`, and `payment-proofs` bucket.
5. **`005_checkin.sql`**: Real-time gate check-in, QR token parsing, atomic `check_in_ticket()` verification, and attendance audit logs.
6. **`006_emails_and_reports.sql`**: Idempotent `email_outbox`, `queue_email()` RPC, bulk reminder dispatching, and CSV report querying.
7. **`007_production_hardening.sql`**: Idempotent storage bucket initialization, production check-in integrity constraints, indexes, and explicit authenticated RPC grants.
8. **`008_event_creation_system.sql`**: Event creation forms, custom questions, and team size constraints.
9. **`009_student_applications_and_registration.sql`**: Application review workflow and registration statuses.
10. **`010_payment_orders_and_checkout.sql`**: Payment orders and checkout structures.
11. **`011_digital_passes_and_qr_delivery.sql`**: Digital passes with secure cryptographic QR tokens.
12. **`012_fix_profiles_rls_for_event_organizers.sql`**: Profile visibility for event organizers.
13. **`013_allow_students_view_registered_events.sql`**: Allows students to view events they have registrations for.
14. **`014_secure_qr_checkin_and_organizer_ops.sql`**: Fast scanner camera check-in and attendance auditing.
15. **`015_security_hardening_and_permissions.sql`**: Storage objects scoping and tampering prevention triggers.
16. **`016_fix_rls_infinite_recursion.sql`**: Decouples cross-table RLS policies between `events`, `registrations`, and `profiles`.
17. **`017_fix_registration_payment_and_checkin_bugs.sql`**: Registration status synchronization and edge case fixes.
18. **`018_trusted_payment_verification_and_replay_hardening.sql`**: Payment replay protection and least-privilege permissions.
19. **`019_upi_only_payments.sql`**: Direct UPI only payments, tamper-evident audit logs (`payment_audit_logs`), and decommissioned gateway checkouts.
20. **`020_team_registration_and_invitations.sql`**: Team formation, invite tokens, squad capacity enforcement, and squad membership.
21. **`021_email_outbox_and_team_tickets.sql`**: Enhanced email templates, team ticket delivery, and idempotent queue deduplication.
22. **`022_attendance_lifecycle_checkout_and_cancellation.sql`**: Check-in, check-out turnstile tracking, and student self-cancellation rules.
23. **`023_club_members_and_permissions.sql`**: Granular role-based club team memberships (`president`, `lead_organizer`, `finance_lead`, `volunteer`).
24. **`024_club_invitation_preview_and_acceptance.sql`**: Secure invitation tokens for joining club teams.
25. **`025_team_invitation_preview_and_acceptance.sql`**: Previews and verification for squad invitations.
26. **`026_team_payment_and_pass_lifecycle.sql`**: Team-wide payment coordination; team leader submits single UTR for entire squad.
27. **`027_fix_gen_random_bytes.sql`**: PostgreSQL pgcrypto extension compatibility fixes.
28. **`028_fix_team_members_rls_recursion.sql`**: Resolves circular dependency in team members RLS policy checks.
29. **`029_fix_profile_role_escalation_trigger.sql`**: Hardens role escalation trigger to block unauthorized privilege elevation.
30. **`030_student_experience_phase1.sql`**: Phase 1: Student experience enhancements, profile fields, avatar uploads, and interests.
31. **`031_club_management_phase2.sql`**: Phase 2: Club profile verification requests, club badges, and social links.
32. **`032_ticketing_and_payments_phase3.sql`**: Phase 3: Coupon codes system (`event_coupons`), redemption counting, and discount calculations.
33. **`033_fix_profile_triggers_and_team_members_rls.sql`**: Cleanup and stabilization of profile triggers and recursive RLS evaluations.
34. **`034_certificates_and_achievements_phase4.sql`**: Phase 4: Verifiable certificates (`event_certificates`), public verification hashes, badge unlocks.
35. **`035_social_and_campus_community_phase5.sql`**: Phase 5: Campus discussion feed (`community_posts`, `community_comments`), teammate discovery opt-in (`teammate_profiles`).
36. **`036_auto_verify_upi_payment.sql`**: Server-side RPC foundation for payment verification and pass delivery.
37. **`037_secure_upi_payment_lifecycle.sql`**: Authoritative payment verification enforcement; passes strictly locked until manual approval.
38. **`038_performance_indexes.sql`**: High-performance composite indexes for Discover events, attendance scanner lookups, and notifications. Guarded with `information_schema` existence checks.
39. **`039_fix_payment_submission_authorization.sql`**: Authoritative payment submission bug fix. Allows student UTR submissions & resubmissions via `submit_payment_submission` RPC without trigger authorization conflicts, while strictly forbidding client-side self-approvals.
40. **`040_advanced_event_experience_phase6.sql`**: Phase 6: Multi-tier ticketing (`event_ticket_tiers`), chronological schedules (`event_schedules`), speakers (`event_speakers`), galleries (`event_gallery`), live announcements (`event_announcements`), competition leaderboard (`event_leaderboards`), and merchandise add-ons (`event_merchandise`).
41. **`041_super_admin_and_platform_management_phase7.sql`**: Phase 7: Super Admin portal (`colleges`, `abuse_reports`, `platform_announcements`, `platform_settings`, `admin_audit_logs`).
42. **`042_notifications_and_automation_phase8.sql`**: Phase 8: Real-time notification center, preferences (`notification_preferences`), waitlist queues (`event_waitlist`), and club automation rules (`event_automation_rules`).
43. **`043_production_excellence_and_scalability_phase9.sql`**: Phase 9: Partial composite indexes, atomic `validate_and_check_in_ticket()` turnstile RPC, offline PWA cache support.

---

## Production Deployment Guide (Vercel)

### Step 1: Deploy Supabase Backend
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and execute migrations `001` through `007`.
3. In **Authentication -> URL Configuration**:
   - **Site URL:** `https://festflow.online`
   - **Redirect URLs:** Add:
     - `https://festflow.online/auth/callback`
     - `https://festflow.online/reset-password`
     - `https://festflow.online/club/dashboard`
     - `https://festflow.online/student/dashboard`
     - `https://festflow.online/**`
     - `http://localhost:5173/**` (for local development)
4. Deploy the transactional email Edge Function & configure secrets:
   ```bash
   npx supabase functions deploy send-email --no-verify-jwt
   npx supabase secrets set RESEND_API_KEY="re_..."
   npx supabase secrets set RESEND_FROM_EMAIL="festflow.events@festflow.online"
   npx supabase secrets set RESEND_FROM_NAME="FestFlow"
   npx supabase secrets set RESEND_REPLY_TO="festflow.events@gmail.com"
   ```
   > **Note:** Resend requires a verified custom domain (`festflow.online`) in `From` (`RESEND_FROM_EMAIL`). Support & reply emails route directly to `festflow.events@gmail.com`.

### Step 2: Deploy Frontend on Vercel
FestFlow includes pre-configured [`vercel.json`](file:///c:/FESTFLOW/vercel.json) with SPA route fallbacks, static asset caching, and security headers.

#### Option A: Deploy via Vercel CLI
```bash
# 1. Install or run Vercel CLI
npx vercel

# 2. Add production environment variables when prompted or via CLI:
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production

# 3. Deploy to production
npx vercel --prod
```

#### Option B: Deploy via GitHub & Vercel Dashboard
1. Push your repository to GitHub.
2. In the Vercel Dashboard, click **Add New Project** and select your repository.
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add Environment Variables:
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
7. Click **Deploy**.

### Step 3: Attaching a Custom Domain (Optional)
1. Go to your project settings in the Vercel Dashboard -> **Domains**.
2. Add your custom domain (e.g. `events.yourcampus.edu` or `festflow.com`).
3. Add the generated `CNAME` or `A` records in your DNS provider (e.g. Cloudflare, Namecheap, GoDaddy).
4. Update your Supabase **Site URL** and **Redirect URLs** to match your custom domain.

---

## Application Route Map

| Path | Description | Access |
|---|---|---|
| `/` | Landing page with hero parallax and features | Public |
| `/discover` | Searchable event catalog with category filters | Public |
| `/events/:slug` | Public event details with registration CTA & modal | Public |
| `/club/signup` | Club representative registration | Public |
| `/club/login` | Club representative login | Public |
| `/student/signup` | Student registration | Public |
| `/student/login` | Student login | Public |
| `/auth/callback` | Supabase email verification & OAuth redirect handler | Public |
| `/privacy` | Platform privacy policy (pre-launch legal draft) | Public |
| `/terms` | Platform terms of service (pre-launch legal draft) | Public |
| `/contact` | Campus help desk and direct organizer inquiry form | Public |
| `/tickets/:id` | Universal digital boarding pass route (links from emails & QR) | Protected (`student`, `platform_admin`) |
| `/club/dashboard` | Organizer dashboard with live metrics & pending payments | Protected (`club_member`, `platform_admin`) |
| `/club/events` | Organizer event management & cancellation | Protected (`club_member`, `platform_admin`) |
| `/club/events/new` | Create & publish new campus events | Protected (`club_member`, `platform_admin`) |
| `/club/events/:id/edit`| Edit draft and published club events | Protected (`club_member`, `platform_admin`) |
| `/club/events/:id/registrations` | Club attendee roster, filter & cancellation | Protected (`club_member`, `platform_admin`) |
| `/club/events/:id/reports` | Executive summary, CSV exports & bulk reminders | Protected (`club_member`, `platform_admin`) |
| `/club/payments` | Organizer UPI payment review & ticket issuance | Protected (`club_member`, `platform_admin`) |
| `/club/settings/payments` | Club official UPI ID & QR code configuration | Protected (`club_member`, `platform_admin`) |
| `/student/dashboard` | Student hub (confirmed passes, pending, history) | Protected (`student`, `platform_admin`) |
| `/student/tickets/:id` | Digital boarding-pass ticket with opaque QR token | Protected (`student`, `platform_admin`) |
| `/student/payments/:registrationId` | UPI payment submission & verification tracking | Protected (`student`, `platform_admin`) |
| `/unauthorized` | Role mismatch / access denied guidance | Authenticated |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type check and production build
npm run build
```
