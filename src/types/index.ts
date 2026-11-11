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
  RefundStatus,
} from '@/lib/database.types'

export type {
  UserRole,
  EventStatus,
  EventType,
  EventCategory,
  RegistrationStatus,
  PaymentStatus,
  RefundStatus,
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
export type ClubProfile = Database['public']['Tables']['club_profiles']['Row'] & {
  cover_url?: string | null
  logo_url?: string | null
  category?: string | null
  social_links?: ClubSocialLinks | null
}
export type StudentProfile = Database['public']['Tables']['student_profiles']['Row'] & {
  interests?: string[] | null
}
export type EventRecord = Database['public']['Tables']['events']['Row'] & {
  cover_url?: string | null
  registration_start_date?: string | null
  page_layout?: EventPageSection[] | null
  waitlist_enabled?: boolean
  is_unlisted?: boolean
  has_multiple_tiers?: boolean
  meeting_platform?: string | null
  meeting_url?: string | null
  joining_instructions?: string | null
  access_window_minutes?: number
  leaderboard_enabled?: boolean
  leaderboard_title?: string
  leaderboard_visibility?: 'public' | 'attendees_only' | 'hidden'
  prizes?: Array<{ rank: string; title: string; amount: string }>
  faqs?: Array<{ question: string; answer: string }>
  gallery_enabled?: boolean
  announcements_enabled?: boolean
  addons_enabled?: boolean
}
export type EventInsert = Database['public']['Tables']['events']['Insert'] & {
  cover_url?: string | null
  registration_start_date?: string | null
  page_layout?: EventPageSection[] | null
  waitlist_enabled?: boolean
  is_unlisted?: boolean
  has_multiple_tiers?: boolean
  meeting_platform?: string | null
  meeting_url?: string | null
  joining_instructions?: string | null
  access_window_minutes?: number
  leaderboard_enabled?: boolean
  leaderboard_title?: string
  leaderboard_visibility?: 'public' | 'attendees_only' | 'hidden'
  prizes?: Array<{ rank: string; title: string; amount: string }>
  faqs?: Array<{ question: string; answer: string }>
  gallery_enabled?: boolean
  announcements_enabled?: boolean
  addons_enabled?: boolean
}
export type EventUpdate = Partial<EventInsert>
export type RegistrationRecord = Database['public']['Tables']['registrations']['Row'] & {
  attendance_status?: AttendanceStatus
  waitlist_offer_expires_at?: string | null
  coupon_id?: string | null
  discount_amount?: number
  ticket_tier_id?: string | null
  ticket_tier_name?: string | null
  unit_price?: number | null
}
export type RegistrationInsert = Database['public']['Tables']['registrations']['Insert'] & {
  waitlist_offer_expires_at?: string | null
  coupon_id?: string | null
  discount_amount?: number
  ticket_tier_id?: string | null
  ticket_tier_name?: string | null
  unit_price?: number | null
}
export type ClubPaymentSettings = Database['public']['Tables']['club_payment_settings']['Row']
export type PaymentSubmission = Database['public']['Tables']['payment_submissions']['Row']
export type InAppNotification = Database['public']['Tables']['in_app_notifications']['Row'] & {
  category?: NotificationCategory
  metadata?: Record<string, any> | null
  archived?: boolean
}
export type CheckInRecord = Database['public']['Tables']['check_ins']['Row']
export type TeamRecord = Database['public']['Tables']['teams']['Row']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type TeamInvitationRecord = Database['public']['Tables']['team_invitations']['Row']
export type TeamMemberRecord = Database['public']['Tables']['team_members']['Row']
export type RegistrationCancellationRequestRecord = Database['public']['Tables']['registration_cancellation_requests']['Row']
export type RegistrationEditRequestRecord = Database['public']['Tables']['registration_edit_requests']['Row']
export type TeamChangeRequestRecord = Database['public']['Tables']['team_change_requests']['Row']
export type WorkflowAuditLogRecord = Database['public']['Tables']['workflow_audit_logs']['Row']
export type PaymentDisputeReviewRecord = Database['public']['Tables']['payment_dispute_reviews']['Row']

export type CancellationReasonType =
  | 'unable_to_attend'
  | 'personal'
  | 'health'
  | 'schedule_conflict'
  | 'wrong_event'
  | 'other'

export const CANCELLATION_REASONS: { value: CancellationReasonType; label: string }[] = [
  { value: 'unable_to_attend', label: 'Unable to attend' },
  { value: 'personal', label: 'Personal reasons' },
  { value: 'health', label: 'Health-related reasons' },
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'wrong_event', label: 'Registered for the wrong event' },
  { value: 'other', label: 'Other' },
]

// ── Club Members & Permissions (Phase 6 + RBAC Repair) ────────────────────────
export type ClubRole =
  | 'owner'
  | 'admin'
  | 'event_manager'
  | 'payment_reviewer'
  | 'checkin_staff'
  | 'viewer'

export type AssignableClubRole =
  | 'admin'
  | 'event_manager'
  | 'payment_reviewer'
  | 'viewer'

export type CanonicalClubPermission =
  | 'club.view'
  | 'club.manage'
  | 'club.transfer_ownership'
  | 'members.view'
  | 'members.invite'
  | 'members.manage'
  | 'roles.assign'
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.publish'
  | 'events.cancel'
  | 'registrations.view'
  | 'registrations.manage'
  | 'payments.view'
  | 'payments.verify'
  | 'payments.settings'
  | 'reports.view'
  | 'reports.export'

export type LegacyClubPermission =
  | 'manage_club'
  | 'manage_members'
  | 'manage_events'
  | 'view_attendees'
  | 'gate_checkin'
  | 'review_payments'
  | 'view_reports'

export type ClubPermission = CanonicalClubPermission | LegacyClubPermission

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
  poster_url?: string | null
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
  poster_url?: string | null
  description?: string | null
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
  is_open?: boolean
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
  latitude?: number | null
  longitude?: number | null
  recommendationReason?: string
  trendingScore?: number
}

// ── Phase 1 Student Experience Types ─────────────────────────────────────────
export type DynamicEventStatus =
  | 'open'
  | 'filling_fast'
  | 'almost_full'
  | 'sold_out'
  | 'registration_closed'
  | 'upcoming'
  | 'live'
  | 'draft'
  | 'completed'
  | 'cancelled'

export interface WishlistRecord {
  id: string
  user_id: string
  event_id: string
  created_at: string
  event?: EventRecord | null
}

export interface RecentlyViewedRecord {
  id: string
  user_id: string
  event_id: string
  viewed_at: string
  event?: EventRecord | null
}

export interface StudentAchievement {
  id: string
  title: string
  description: string
  iconName: string
  badgeLabel: string
  progress: number
  total: number
  unlocked: boolean
  unlockedAt?: string
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

export type BadgeVariant = 'default' | 'purple' | 'pink' | 'amber' | 'cyan' | 'success' | 'outline' | 'danger' | 'neutral' | 'brand' | 'violet' | 'magenta' | 'blue'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg'

// ── Phase 2 Advanced Club Management Types ──────────────────────────────────
export type EventPageSectionType =
  | 'hero'
  | 'intro'
  | 'about'
  | 'highlights'
  | 'schedule'
  | 'speakers'
  | 'gallery'
  | 'faqs'
  | 'cta'
  | 'organizer'

export interface EventPageSection {
  id: string
  type: EventPageSectionType
  title?: string
  enabled: boolean
  content?: Record<string, any>
}

export interface EventCouponRecord {
  id: string
  club_id: string
  event_id?: string | null
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_purchase_amount?: number | null
  max_discount_amount?: number | null
  max_uses?: number | null
  used_count: number
  valid_from?: string | null
  valid_until?: string | null
  is_active: boolean
  created_at: string
}

export interface CouponValidationResult {
  valid: boolean
  coupon?: EventCouponRecord
  discountAmount: number
  finalPrice: number
  error?: string
}

export type AssignableEventAssignmentRole =
  | 'event_manager'
  | 'registration_manager'
  | 'finance_manager'
  | 'content_manager'

export type EventAssignmentRole =
  | AssignableEventAssignmentRole
  | 'checkin_staff'

export interface EventAssignmentRecord {
  id: string
  event_id: string
  club_id: string
  user_id: string
  role: EventAssignmentRole
  assigned_by?: string | null
  created_at: string
  user?: Profile | null
  event?: EventRecord | null
}

export interface EventFeedbackRecord {
  id: string
  event_id: string
  user_id: string
  rating: number
  comment?: string | null
  is_anonymous: boolean
  created_at: string
  user?: Profile | null
}

export interface ClubSocialLinks {
  instagram?: string
  linkedin?: string
  twitter?: string
  discord?: string
  website?: string
  youtube?: string
}

export interface WaitlistPromotionResult {
  promotedCount: number
  notifiedStudents: string[]
}

// ── Phase 4 Achievements & Badges Types ────────────────────────────────────────

export interface StudentBadgeRecord {
  id: string
  student_id: string
  badge_key: string
  title: string
  description: string
  icon_name: string
  category: 'attendance' | 'awards' | 'participation' | 'mastery'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  earned_at: string
  is_pinned: boolean
  is_public: boolean
  metadata?: Record<string, any>
  created_at: string
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: SOCIAL & CAMPUS COMMUNITY TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type ProfileVisibility = 'public' | 'campus_only' | 'private'
export type TeammateAvailability = 'actively_looking' | 'open_to_offers' | 'unavailable'
export type TeammateRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'
export type ReportTargetType = 'profile' | 'comment' | 'message' | 'announcement' | 'teammate_request' | 'user' | 'club'
export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed'

export type ClubFollowerRecord = Database['public']['Tables']['club_followers']['Row'] & {
  student?: Profile | null
  club?: ClubProfile | null
}

export type ClubAnnouncementRecord = Database['public']['Tables']['club_announcements']['Row'] & {
  club?: ClubProfile | null
  author?: Profile | null
}

export type EventDiscussionRecord = Database['public']['Tables']['event_discussions']['Row'] & {
  author?: Profile | null
  replies?: EventDiscussionRecord[]
  is_organizer?: boolean
}

export type TeammateProfileRecord = Database['public']['Tables']['teammate_profiles']['Row'] & {
  student?: Profile | null
  student_profile?: StudentProfile | null
}

export type TeammateRequestRecord = Database['public']['Tables']['teammate_requests']['Row'] & {
  sender?: Profile | null
  receiver?: Profile | null
  event?: EventRecord | null
}

export type ConversationRecord = Database['public']['Tables']['conversations']['Row'] & {
  other_participant?: Profile | null
  unread_count?: number
}

export type DirectMessageRecord = Database['public']['Tables']['messages']['Row'] & {
  sender?: Profile | null
}

export type UserBlockRecord = Database['public']['Tables']['user_blocks']['Row']

export type CommunityReportRecord = Database['public']['Tables']['community_reports']['Row']

export type CampusFeedItemType = 'announcement' | 'event' | 'achievement' | 'milestone'

export interface CampusFeedItem {
  id: string
  type: CampusFeedItemType
  timestamp: string
  title: string
  content?: string | null
  imageUrl?: string | null
  linkUrl?: string | null
  author: {
    id: string
    name: string
    avatarUrl?: string | null
    isClub: boolean
    isVerified?: boolean
    roleBadge?: string | null
  }
  meta?: {
    eventName?: string
    eventSlug?: string
    eventCategory?: string
    eventStartDate?: string
    badgeTier?: string
    isPinned?: boolean
    isMembersOnly?: boolean
  }
}

export interface StudentPublicProfile {
  id: string
  displayName: string
  avatarUrl?: string | null
  bio?: string | null
  collegeName?: string | null
  course?: string | null
  academicYear?: string | null
  skills: string[]
  interests: string[]
  preferredCategories: string[]
  socialLinks: Record<string, string>
  visibility: ProfileVisibility
  hideEvents: boolean
  hideSkills: boolean
  badges: StudentBadgeRecord[]
  attendedEventsCount: number
  isTeammateDiscoverable: boolean
  teammateAvailability?: TeammateAvailability | null
}

export interface ClubPublicProfile {
  id: string
  clubName: string
  representativeName: string
  description?: string | null
  websiteUrl?: string | null
  isVerified: boolean
  category: string
  logoUrl?: string | null
  coverUrl?: string | null
  socialLinks: Record<string, string>
  followersCount: number
  isFollowing: boolean
  upcomingEvents: EventRecord[]
  pastEvents: EventRecord[]
  announcements: ClubAnnouncementRecord[]
}

// ── Phase 6 Advanced Event Experience Types ──────────────────────────────────
export type TicketTierType = 'standard' | 'early_bird' | 'vip' | 'student' | 'group' | 'free'

export interface EventTicketTier {
  id: string
  event_id: string
  name: string
  tier_type: TicketTierType
  description?: string | null
  price: number
  original_price?: number | null
  capacity: number
  sold_count: number
  available_from?: string | null
  available_until?: string | null
  perks: string[]
  is_active: boolean
  max_per_order: number
  eligibility?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ScheduleCategory =
  | 'keynote'
  | 'workshop'
  | 'competition'
  | 'networking'
  | 'panel'
  | 'break'
  | 'ceremony'
  | 'general'

export interface EventScheduleItem {
  id: string
  event_id: string
  day_number: number
  start_time: string
  end_time?: string | null
  title: string
  description?: string | null
  speaker_name?: string | null
  venue_stage?: string | null
  category: ScheduleCategory
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type SpeakerRole =
  | 'keynote_speaker'
  | 'speaker'
  | 'judge'
  | 'mentor'
  | 'host'
  | 'panelist'

export interface EventSpeaker {
  id: string
  event_id: string
  name: string
  designation?: string | null
  organization?: string | null
  bio?: string | null
  avatar_url?: string | null
  role: SpeakerRole
  social_links?: {
    linkedin?: string
    twitter?: string
    github?: string
    website?: string
  }
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface EventGalleryImage {
  id: string
  event_id: string
  image_url: string
  caption?: string | null
  tags?: string[]
  sort_order: number
  uploaded_by?: string | null
  created_at: string
}

export type AnnouncementPriority = 'normal' | 'urgent' | 'schedule_change' | 'venue_change' | 'results'

export interface EventAnnouncement {
  id: string
  event_id: string
  club_id: string
  author_id?: string | null
  title: string
  content: string
  priority: AnnouncementPriority
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export type LeaderboardSubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'evaluated'
  | 'finalist'
  | 'disqualified'

export interface EventLeaderboardEntry {
  id: string
  event_id: string
  participant_id?: string | null
  team_id?: string | null
  participant_name: string
  team_name?: string | null
  score: number
  rank?: number | null
  submission_status: LeaderboardSubmissionStatus
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface EventAddon {
  id: string
  event_id: string
  name: string
  description?: string | null
  image_url?: string | null
  price: number
  stock_quantity: number
  sold_quantity: number
  is_active: boolean
  max_per_user: number
  created_at?: string
  updated_at?: string
}

export interface EventOnlineDetails {
  accessible: boolean
  error_code?: string
  message?: string
  platform?: string
  meeting_url?: string | null
  joining_instructions?: string | null
  unlocks_at?: string
  is_organizer?: boolean
}

export interface RelatedEventSummary {
  id: string
  slug: string
  title: string
  category: string
  poster_url?: string | null
  cover_url?: string | null
  start_date: string
  venue_name: string
  is_free: boolean
  price: number
  participation_type: string
}

// =============================================================================
// PHASE 7: SUPER ADMIN & PLATFORM MANAGEMENT TYPES
// =============================================================================

export type AdminRole =
  | 'super_admin'
  | 'platform_moderator'
  | 'college_admin'
  | 'support_admin'

export type AdminPermission =
  | 'manage_colleges'
  | 'verify_clubs'
  | 'moderate_events'
  | 'review_reports'
  | 'manage_announcements'
  | 'view_analytics'
  | 'manage_settings'
  | 'manage_finances'
  | 'manage_admins'

export type CollegeStatus = 'active' | 'pending_verification' | 'suspended'

export type {
  CollegeDistrict,
  InstitutionType,
  ManagementType,
  CollegeVerificationStatus,
  VerificationAuthority,
  CollegeDirectoryRecord,
  CollegeVerificationHistoryRecord,
  CollegeRequestRecord,
  CollegeSearchFilters,
  CollegeSearchResult,
} from '@/lib/collegeDirectory'

export interface CollegeRecord {
  id: string
  name: string
  code?: string | null
  domain?: string | null
  city?: string | null
  state?: string | null
  country: string
  logo_url?: string | null
  website?: string | null
  status: CollegeStatus
  verification_notes?: string | null
  verified_at?: string | null
  verified_by?: string | null
  created_at: string
  updated_at: string
  // Aggregated metadata
  club_count?: number
  student_count?: number
}

export interface PlatformAdminRecord {
  id: string
  user_id: string
  role: AdminRole
  permissions: AdminPermission[]
  assigned_by?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  profile?: Profile | null
}

export interface AdminAuditLogRecord {
  id: string
  admin_id: string
  admin_email: string
  action: string
  target_entity: string
  target_record_id?: string | null
  previous_state?: Record<string, any> | null
  new_state?: Record<string, any> | null
  reason?: string | null
  metadata?: Record<string, any>
  created_at: string
}

export interface PlatformAnnouncementRecord {
  id: string
  title: string
  content: string
  banner_url?: string | null
  target_audience: 'all' | 'students' | 'clubs' | 'colleges'
  target_college_id?: string | null
  is_pinned: boolean
  status: 'draft' | 'published' | 'archived'
  created_by: string
  published_at?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
  author?: Profile | null
}

export interface PlatformSettingsMap {
  maintenance_mode: boolean
  student_registration_enabled: boolean
  club_event_creation_enabled: boolean
  require_event_approval: boolean
  max_upload_size_mb: number
  allowed_upload_types: string[]
  support_email: string
  support_phone: string
  platform_fee_percentage: number
  announcement_banner_enabled: boolean
  [key: string]: any
}

export interface PlatformMetrics {
  total_students: number
  total_clubs: number
  total_verified_clubs: number
  total_colleges: number
  total_events: number
  total_published_events: number
  total_pending_moderation: number
  total_registrations: number
  total_pending_payments: number
  total_verified_payments: number
  total_issued_passes: number
  total_check_ins: number
  total_revenue_inr: number
}

export type EventModerationStatus =
  | 'approved'
  | 'pending_approval'
  | 'rejected'
  | 'changes_requested'
  | 'unpublished'

export interface AdminReportRecord {
  id: string
  reporter_id: string
  target_type: 'profile' | 'club' | 'event' | 'comment' | 'message' | 'announcement' | 'teammate_request' | 'payment'
  target_id: string
  reason: string
  details?: string | null
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed'
  action_taken?: string | null
  moderator_notes?: string | null
  created_at: string
  updated_at: string
  reporter?: Profile | null
  target_title?: string
}

export interface AdminEventRecord {
  id: string
  title: string
  slug: string
  category: string
  status: string
  moderation_status: EventModerationStatus
  moderation_notes?: string | null
  start_date: string
  end_date: string
  venue_name: string
  is_free: boolean
  price: number
  capacity: number
  club_name?: string
  created_at: string
}

export interface AdminClubRecord {
  id: string
  profile_id: string
  club_name: string
  representative_name: string
  description?: string | null
  website_url?: string | null
  is_verified: boolean
  status: 'active' | 'suspended' | 'pending_verification'
  college_name?: string | null
  verification_notes?: string | null
  suspension_reason?: string | null
  created_at: string
  event_count?: number
  member_count?: number
}

export interface AdminStudentRecord {
  id: string
  display_name: string
  email: string
  college_name?: string | null
  graduation_year?: number | null
  status: 'active' | 'suspended'
  suspension_reason?: string | null
  created_at: string
  registration_count?: number
  pass_count?: number
}

export interface AdminPaymentRecord {
  id: string
  registration_id: string
  event_id: string
  event_title: string
  club_name: string
  student_name: string
  student_email: string
  utr: string
  amount: number
  status: 'pending' | 'verified' | 'rejected'
  screenshot_url?: string | null
  created_at: string
  verified_at?: string | null
}

// ── Phase 8 Notifications & Automation Types ────────────────────────────────
export type NotificationCategory =
  | 'registration'
  | 'payment'
  | 'events'
  | 'team_invitations'
  | 'digital_passes'
  | 'announcements'
  | 'reminders'
  | 'club_activity'
  | 'platform_updates'
  | 'general'

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string | null
  created_at: string
  updated_at: string
}

export interface UserNotificationPreferences {
  user_id: string
  email_enabled: boolean
  push_enabled: boolean
  event_reminders: boolean
  payment_updates: boolean
  club_announcements: boolean
  platform_announcements: boolean
  team_notifications: boolean
  updated_at?: string
}

export interface EventWaitlistRecord {
  event_id: string
  is_enabled: boolean
  max_capacity: number
  auto_promote: boolean
  created_at?: string
}

export interface EventWaitlistEntryRecord {
  id: string
  event_id: string
  student_id: string
  position: number
  status: 'waiting' | 'offered' | 'claimed' | 'expired' | 'cancelled'
  offer_expires_at?: string | null
  created_at: string
  updated_at: string
  student_name?: string
  student_email?: string
}

export interface ClubEventAutomationRecord {
  id: string
  event_id: string
  club_id: string
  trigger_type:
    | 'welcome_registration'
    | 'reminder_7d'
    | 'reminder_3d'
    | 'reminder_1d'
    | 'reminder_2h'
    | 'post_event_feedback'
  schedule_offset?: string | null
  message_template: string
  is_enabled: boolean
  last_executed_at?: string | null
  created_at: string
}

export interface AutomationQueueMetrics {
  emails_queued: number
  emails_sent: number
  emails_failed: number
  push_subscriptions_count: number
  waitlist_active_count: number
  active_automations_count: number
}

