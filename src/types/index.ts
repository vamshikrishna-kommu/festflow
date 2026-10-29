// Shared TypeScript types for FestFlow
import type {
  Database,
  UserRole,
  EventStatus,
  EventType,
  EventCategory,
  RegistrationStatus,
  PaymentStatus,
  CheckInOutcome,
  ParticipationType,
  ApprovalType,
  TeamRegistrationMode,
  CustomQuestionType,
  CustomQuestion,
  ParticipantFieldsRequirement,
} from '@/lib/database.types'

export type {
  UserRole,
  EventStatus,
  EventType,
  EventCategory,
  RegistrationStatus,
  PaymentStatus,
  CheckInOutcome,
  Database,
  ParticipationType,
  ApprovalType,
  TeamRegistrationMode,
  CustomQuestionType,
  CustomQuestion,
  ParticipantFieldsRequirement,
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ClubProfile = Database['public']['Tables']['club_profiles']['Row']
export type StudentProfile = Database['public']['Tables']['student_profiles']['Row']
export type EventRecord = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']
export type RegistrationRecord = Database['public']['Tables']['registrations']['Row'] & {
  attendance_status?: AttendanceStatus
}
export type RegistrationInsert = Database['public']['Tables']['registrations']['Insert']
export type ClubPaymentSettings = Database['public']['Tables']['club_payment_settings']['Row']
export type PaymentSubmission = Database['public']['Tables']['payment_submissions']['Row']
export type InAppNotification = Database['public']['Tables']['in_app_notifications']['Row']
export type CheckInRecord = Database['public']['Tables']['check_ins']['Row']
export type TeamRecord = Database['public']['Tables']['teams']['Row']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type TeamInvitationRecord = Database['public']['Tables']['team_invitations']['Row']
export type TeamMemberRecord = Database['public']['Tables']['team_members']['Row']

// ── Club Members & Permissions (Phase 6) ────────────────────────────────────
export type ClubRole =
  | 'owner'
  | 'admin'
  | 'event_manager'
  | 'payment_reviewer'
  | 'checkin_staff'
  | 'viewer'

export type ClubPermission =
  | 'manage_club'
  | 'manage_members'
  | 'manage_events'
  | 'view_attendees'
  | 'gate_checkin'
  | 'review_payments'
  | 'view_reports'

export interface ClubMemberRecord {
  id: string
  club_id: string
  user_id: string
  role: ClubRole
  status: 'active' | 'suspended' | 'revoked'
  created_at: string
  updated_at: string
  profile?: Profile | null
  club?: ClubProfile | null
  club_name?: string | null
}

export interface ClubInvitationRecord {
  id: string
  club_id: string
  email: string
  role: ClubRole
  invited_by: string
  token: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  accepted_at?: string | null
  accepted_by?: string | null
  created_at: string
  updated_at: string
  inviter?: Profile | null
  club?: ClubProfile | null
  club_name?: string | null
  inviter_name?: string | null
  masked_email?: string | null
  is_recipient_matched?: boolean
}

export interface ClubAuditLogRecord {
  id: string
  club_id: string
  actor_id: string
  action:
    | 'member_invited'
    | 'invitation_accepted'
    | 'invitation_revoked'
    | 'invitation_resent'
    | 'role_updated'
    | 'member_removed'
    | 'ownership_transferred'
  target_id?: string | null
  target_email?: string | null
  old_value?: string | null
  new_value?: string | null
  details?: Record<string, any>
  created_at: string
  actor?: Profile | null
}

export interface TeamPreview {
  team_id: string
  team_name: string
  event_id: string
  event_title: string
  event_slug: string
  event_category: EventCategory
  event_poster?: string | null
  start_date: string
  venue_name: string
  is_free: boolean
  price?: number
  leader_name: string
  current_size: number
  min_size: number
  max_size: number
  is_full: boolean
  is_open: boolean
  require_team_name: boolean
}

export interface TeamJoinResponse {
  success: boolean
  message: string
  error_code?: string
  team_id?: string
  team_name?: string
  registration_id?: string
  ticket_code?: string
  member_count?: number
}

export interface TeamInviteResponse {
  success: boolean
  message: string
  error_code?: string
  invitation_id?: string
  token?: string
  invite_code?: string
  email?: string
  invitation_created_email_failed?: boolean
  email_dispatch_error?: string
}

export interface TeamInvitationPreview {
  id: string
  team_id: string
  team_name: string
  event_id: string
  event_title: string
  event_slug: string
  event_category?: EventCategory
  venue_name?: string
  start_date?: string
  is_free?: boolean
  price?: number
  leader_name: string
  invite_code: string
  recipient_email?: string
  masked_email: string
  is_recipient_matched: boolean
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
  expires_at: string
  current_size: number
  max_size: number
  is_full: boolean
}

export interface TeamDetails extends TeamRecord {
  event?: EventRecord | null
  leader?: { display_name: string; email?: string } | null
  members: TeamMemberRecord[]
  invitations: TeamInvitationRecord[]
  userRole?: 'leader' | 'member' | null
}

export interface EventWithClub extends EventRecord {
  club?: {
    display_name: string
    avatar_url: string | null
    club_profile?: ClubProfile | null
  }
}

export interface RegistrationWithEvent extends RegistrationRecord {
  event?: (EventRecord & {
    club?: {
      display_name: string
      club_profiles?: ClubProfile[] | ClubProfile | null
    }
  }) | null
  payment_submission?: PaymentSubmission | null
}

export interface RegistrationWithStudent extends RegistrationRecord {
  student?: {
    display_name: string
    email: string
    avatar_url: string | null
  } | null
}

export interface PaymentSubmissionWithDetails extends PaymentSubmission {
  student?: {
    display_name: string
    email: string
    avatar_url: string | null
  }
  event?: EventRecord
  registration?: RegistrationRecord
}

export interface PaymentSubmissionResponse {
  success: boolean
  message: string
  submission_id?: string
  error_code?: string
  status?: PaymentStatus
}

export interface PaymentReviewResponse {
  success: boolean
  message: string
  error_code?: string
  status?: PaymentStatus
  ticket_code?: string
}

export type AttendanceStatus =
  | 'not_checked_in'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'ineligible'

export interface CheckInResponse {
  success: boolean
  outcome: CheckInOutcome
  message: string
  student_name?: string
  ticket_code?: string
  checked_in_at?: string
  checked_out_at?: string
  is_reentry?: boolean
  entry_count?: number
  allow_reentry?: boolean
  event_title?: string
  member_index?: number
  member_name?: string
  team_name?: string
  isNetworkError?: boolean
}

export interface CheckInStats {
  totalCapacity: number
  confirmedRegistrations: number
  checkedInCount: number
  checkedOutCount: number
  notCheckedInCount: number
  successfulCheckIns: number
  remainingExpected: number
  attendancePercentage: number
}

export interface RegistrationWithCheckIn extends RegistrationWithStudent {
  check_in?: CheckInRecord | null
  check_ins?: CheckInRecord[]
  attendance_status?: AttendanceStatus
}

export interface TeamMember {
  name: string
  email: string
  college?: string
  studentId?: string
  phone?: string
}

export interface RegistrationResponse {
  success: boolean
  error_code?: string
  message: string
  registration_id?: string
  ticket_code?: string
  qr_token?: string
  status?: RegistrationStatus
  approval_status?: string
  is_free?: boolean
  ticket_issued?: boolean
  team_id?: string
  invite_code?: string
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  avatarUrl?: string | null
  emailConfirmed: boolean
  clubProfile?: ClubProfile | null
  studentProfile?: StudentProfile | null
}

export interface Event {
  id: string
  title: string
  slug: string
  clubName: string
  clubAvatar: string
  category: EventCategory
  tags: string[]
  date: string          // ISO 8601
  time: string          // e.g. "6:00 PM"
  location: string
  venue: string
  coverImage: string
  description: string
  isFree: boolean
  price?: number        // in INR, undefined when free
  capacity: number
  registeredCount: number
  isFeatured: boolean
  status?: EventStatus
  summary?: string
  eventType?: EventType
  venueAddress?: string | null
  startDate?: string
  endDate?: string
  registrationDeadline?: string | null
  eligibility?: string | null
  rules?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  onlineMeetingUrl?: string | null
  timezone?: string
  approvalType?: ApprovalType
  participationType?: ParticipationType
  minTeamSize?: number
  maxTeamSize?: number
  leaderCountsTowardsSize?: boolean
  teamRegistrationMode?: TeamRegistrationMode
  requireTeamName?: boolean
  allowedColleges?: string[] | null
  allowedDepartments?: string[] | null
  allowedYears?: number[] | null
  customQuestions?: CustomQuestion[]
  participantFields?: ParticipantFieldsRequirement
  clubId?: string
}

export interface Club {
  id: string
  name: string
  avatar: string
  college: string
  verified: boolean
  eventCount: number
}

export interface NavLink {
  label: string
  href: string
}

export type BadgeVariant = 'default' | 'purple' | 'pink' | 'amber' | 'cyan' | 'success' | 'outline' | 'danger'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg'
