// Shared TypeScript types for FestFlow
import type {
  Database,
  UserRole,
  EventStatus,
  EventType,
  EventCategory,
  RegistrationStatus,
  PaymentStatus,
  OrderStatus,
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
  OrderStatus,
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
export type RegistrationRecord = Database['public']['Tables']['registrations']['Row']
export type RegistrationInsert = Database['public']['Tables']['registrations']['Insert']
export type ClubPaymentSettings = Database['public']['Tables']['club_payment_settings']['Row']
export type PaymentSubmission = Database['public']['Tables']['payment_submissions']['Row']
export type PaymentOrder = Database['public']['Tables']['payment_orders']['Row']
export type PaymentOrderInsert = Database['public']['Tables']['payment_orders']['Insert']
export type InAppNotification = Database['public']['Tables']['in_app_notifications']['Row']
export type CheckInRecord = Database['public']['Tables']['check_ins']['Row']

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

export interface PaymentOrderWithDetails extends PaymentOrder {
  student?: {
    display_name: string
    email: string
    avatar_url: string | null
  }
  event?: EventRecord
  registration?: RegistrationRecord
}

export interface CreateOrderResponse {
  success: boolean
  message: string
  error_code?: string
  order?: {
    id: string
    order_reference: string
    registration_id: string
    event_id: string
    event_title: string
    amount: number
    currency: string
    provider: string
    provider_order_id?: string | null
    status: OrderStatus
    created_at: string
  }
}

export interface VerifyOrderResponse {
  success: boolean
  message: string
  error_code?: string
  order_id?: string
  ticket_code?: string
  status?: OrderStatus
}

export interface CheckInResponse {
  success: boolean
  outcome: CheckInOutcome
  message: string
  student_name?: string
  ticket_code?: string
  checked_in_at?: string
  event_title?: string
  member_index?: number
  member_name?: string
  team_name?: string
  isNetworkError?: boolean
}

export interface CheckInStats {
  totalCapacity: number
  confirmedRegistrations: number
  successfulCheckIns: number
  remainingExpected: number
  attendancePercentage: number
}

export interface RegistrationWithCheckIn extends RegistrationWithStudent {
  check_in?: CheckInRecord | null
  check_ins?: CheckInRecord[]
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
