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

## Database Migrations (001 – 016)

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
10. **`010_payment_orders_and_checkout.sql`**: Payment order creation and Razorpay checkout support.
11. **`011_digital_passes_and_qr_delivery.sql`**: Digital passes with secure cryptographic QR tokens.
12. **`012_fix_profiles_rls_for_event_organizers.sql`**: Profile visibility for event organizers.
13. **`013_allow_students_view_registered_events.sql`**: Allows students to view events they have registrations for.
14. **`014_secure_qr_checkin_and_organizer_ops.sql`**: Fast scanner camera check-in and attendance auditing.
15. **`015_security_hardening_and_permissions.sql`**: Storage objects scoping and tampering prevention triggers.
16. **`016_fix_rls_infinite_recursion.sql`**: **(CRITICAL FIX)** Decouples cross-table RLS policies between `events`, `registrations`, and `profiles` using `SECURITY DEFINER` helper functions, completely eliminating PostgreSQL circular policy recursion (`infinite recursion detected in policy for relation "registrations"`).

---

## Production Deployment Guide (Vercel)

### Step 1: Deploy Supabase Backend
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and execute migrations `001` through `007`.
3. In **Authentication -> URL Configuration**:
   - **Site URL:** `https://<your-vercel-domain>.vercel.app` (or your custom domain)
   - **Redirect URLs:** Add:
     - `https://<your-vercel-domain>.vercel.app/auth/callback`
     - `https://<your-vercel-domain>.vercel.app/club/dashboard`
     - `https://<your-vercel-domain>.vercel.app/student/dashboard`
     - `http://localhost:5173/**` (for local development)
4. Deploy the transactional email Edge Function:
   ```bash
   npx supabase functions deploy send-email --no-verify-jwt
   npx supabase secrets set RESEND_API_KEY="re_..."
   npx supabase secrets set RESEND_FROM_EMAIL="FestFlow <events@yourdomain.com>"
   ```

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
| `/club/events/:id/check-in` | Gate camera QR scanner & live attendance check-in | Protected (`club_member`, `platform_admin`) |
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
