// Database type definitions for FestFlow
export type UserRole = 'student' | 'club_member' | 'platform_admin'
export type EventStatus = 'draft' | 'published' | 'registration_closed' | 'cancelled' | 'completed'
export type EventType = 'offline' | 'online' | 'hybrid'
export type ParticipationType = 'individual' | 'team'
export type ApprovalType = 'automatic' | 'manual'
export type TeamRegistrationMode = 'leader_adds_members' | 'members_join_with_code'
export type CustomQuestionType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio'

export interface CustomQuestion {
  id: string
  label: string
  type: CustomQuestionType
  required: boolean
  options?: string[]
  placeholder?: string
  helperText?: string
}

export interface ParticipantFieldsRequirement {
  require_college: boolean
  require_phone: boolean
  require_grad_year: boolean
  require_id_card: boolean
}

export type EventCategory =
  | 'tech'
  | 'cultural'
  | 'sports'
  | 'workshop'
  | 'seminar'
  | 'hackathon'
  | 'music'
  | 'art'
  | 'gaming'
  | 'social'

export type RegistrationStatus =
  | 'pending_approval'
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'rejected'
  | 'waitlisted'
export type PaymentStatus = 'pending_review' | 'approved' | 'rejected'
export type OrderStatus = 'created' | 'attempted' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'expired'
export type CheckInOutcome =
  | 'VALID'
  | 'ALREADY_USED'
  | 'INVALID_TICKET'
  | 'WRONG_EVENT'
  | 'NOT_CONFIRMED'
  | 'CANCELLED'
  | 'UNAUTHORIZED'
  | 'CHECKED_OUT'
  | 'NOT_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          display_name: string
          email: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role: UserRole
          display_name: string
          email: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      club_profiles: {
        Row: {
          id: string
          profile_id: string
          club_name: string
          representative_name: string
          website_url: string | null
          description: string | null
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          club_name: string
          representative_name: string
          website_url?: string | null
          description?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['club_profiles']['Insert']>
      }
      student_profiles: {
        Row: {
          id: string
          profile_id: string
          college_name: string | null
          graduation_year: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          college_name?: string | null
          graduation_year?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['student_profiles']['Insert']>
      }
      events: {
        Row: {
          id: string
          slug: string
          club_id: string
          title: string
          summary: string
          description: string
          category: EventCategory
          poster_url: string | null
          start_date: string
          end_date: string
          venue_name: string
          venue_address: string | null
          event_type: EventType
          registration_opens_at: string | null
          registration_closes_at: string | null
          capacity: number
          is_free: boolean
          price: number
          currency: string
          eligibility: string | null
          rules: string | null
          contact_email: string | null
          contact_phone: string | null
          online_meeting_url: string | null
          timezone: string
          approval_type: ApprovalType
          participation_type: ParticipationType
          min_team_size: number
          max_team_size: number
          leader_counts_towards_size: boolean
          team_registration_mode: TeamRegistrationMode
          require_team_name: boolean
          allowed_colleges: string[] | null
          allowed_departments: string[] | null
          allowed_years: number[] | null
          custom_questions: CustomQuestion[]
          participant_fields: ParticipantFieldsRequirement
          status: EventStatus
          allow_reentry?: boolean
          require_checkout?: boolean
          cancellation_cutoff_hours?: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          club_id: string
          title: string
          summary: string
          description: string
          category: EventCategory
          poster_url?: string | null
          start_date: string
          end_date: string
          venue_name: string
          venue_address?: string | null
          event_type?: EventType
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          capacity: number
          is_free?: boolean
          price?: number
          currency?: string
          eligibility?: string | null
          rules?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          online_meeting_url?: string | null
          timezone?: string
          approval_type?: ApprovalType
          participation_type?: ParticipationType
          min_team_size?: number
          max_team_size?: number
          leader_counts_towards_size?: boolean
          team_registration_mode?: TeamRegistrationMode
          require_team_name?: boolean
          allowed_colleges?: string[] | null
          allowed_departments?: string[] | null
          allowed_years?: number[] | null
          custom_questions?: CustomQuestion[]
          participant_fields?: ParticipantFieldsRequirement
          status?: EventStatus
          allow_reentry?: boolean
          require_checkout?: boolean
          cancellation_cutoff_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      registrations: {
        Row: {
          id: string
          event_id: string
          student_id: string
          ticket_code: string
          qr_token: string
          status: RegistrationStatus
          team_name: string | null
          team_role: 'leader' | 'member' | null
          team_id: string | null
          team_members: any[] | null
          custom_responses: Record<string, any> | null
          participant_details: Record<string, any> | null
          approval_status: 'pending' | 'approved' | 'rejected' | null
          rejection_reason: string | null
          created_at: string
          ticket_issued_at: string | null
          cancelled_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          student_id: string
          ticket_code: string
          qr_token?: string
          status?: RegistrationStatus
          team_name?: string | null
          team_role?: 'leader' | 'member' | null
          team_id?: string | null
          team_members?: any[] | null
          custom_responses?: Record<string, any> | null
          participant_details?: Record<string, any> | null
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          rejection_reason?: string | null
          created_at?: string
          ticket_issued_at?: string | null
          cancelled_at?: string | null
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['registrations']['Insert']>
      }
      club_payment_settings: {
        Row: {
          id: string
          club_id: string
          upi_id: string
          account_name: string
          payment_instructions: string | null
          qr_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          club_id: string
          upi_id: string
          account_name: string
          payment_instructions?: string | null
          qr_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['club_payment_settings']['Insert']>
      }
      payment_submissions: {
        Row: {
          id: string
          registration_id: string
          student_id: string
          event_id: string
          amount: number
          currency: string
          transaction_reference: string
          screenshot_url: string | null
          status: PaymentStatus
          reviewer_id: string | null
          review_notes: string | null
          submitted_at: string
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          registration_id: string
          student_id: string
          event_id: string
          amount: number
          currency?: string
          transaction_reference: string
          screenshot_url?: string | null
          status?: PaymentStatus
          reviewer_id?: string | null
          review_notes?: string | null
          submitted_at?: string
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['payment_submissions']['Insert']>
      }
      payment_orders: {
        Row: {
          id: string
          order_reference: string
          registration_id: string
          student_id: string
          event_id: string
          amount: number
          currency: string
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          provider_signature: string | null
          status: OrderStatus
          idempotency_key: string | null
          receipt: string | null
          metadata: Record<string, unknown>
          error_code: string | null
          error_description: string | null
          created_at: string
          updated_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          order_reference: string
          registration_id: string
          student_id: string
          event_id: string
          amount: number
          currency?: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          provider_signature?: string | null
          status?: OrderStatus
          idempotency_key?: string | null
          receipt?: string | null
          metadata?: Record<string, unknown>
          error_code?: string | null
          error_description?: string | null
          created_at?: string
          updated_at?: string
          paid_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['payment_orders']['Insert']>
      }
      in_app_notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['in_app_notifications']['Insert']>
      }
      check_ins: {
        Row: {
          id: string
          registration_id: string
          event_id: string
          ticket_code: string
          staff_id: string
          checked_in_at: string
          checkin_notes: string | null
          member_index: number
          member_name: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          checkout_notes: string | null
          status: 'checked_in' | 'checked_out'
          entry_count: number
          created_at: string
        }
        Insert: {
          id?: string
          registration_id: string
          event_id: string
          ticket_code: string
          staff_id: string
          checked_in_at?: string
          checkin_notes?: string | null
          member_index?: number
          member_name?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          checkout_notes?: string | null
          status?: 'checked_in' | 'checked_out'
          entry_count?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['check_ins']['Insert']>
      }
      email_outbox: {
        Row: {
          id: string
          recipient_email: string
          recipient_name: string | null
          user_id: string | null
          event_id: string | null
          registration_id: string | null
          template_type: string
          subject: string
          payload: Record<string, unknown>
          status: 'pending' | 'sent' | 'failed' | 'disabled'
          idempotency_key: string | null
          sent_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          recipient_email: string
          recipient_name?: string | null
          user_id?: string | null
          event_id?: string | null
          registration_id?: string | null
          template_type: string
          subject: string
          payload?: Record<string, unknown>
          status?: 'pending' | 'sent' | 'failed' | 'disabled'
          idempotency_key?: string | null
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['email_outbox']['Insert']>
      }
      teams: {
        Row: {
          id: string
          event_id: string
          leader_id: string
          registration_id: string | null
          name: string
          invite_code: string
          status: 'forming' | 'complete' | 'locked' | 'disbanded'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          leader_id: string
          registration_id?: string | null
          name: string
          invite_code: string
          status?: 'forming' | 'complete' | 'locked' | 'disbanded'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      team_invitations: {
        Row: {
          id: string
          team_id: string
          event_id: string
          inviter_id: string
          email: string
          token: string
          status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
          expires_at: string
          accepted_by: string | null
          accepted_at: string | null
          last_sent_at: string
          resend_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          event_id: string
          inviter_id: string
          email: string
          token: string
          status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
          expires_at?: string
          accepted_by?: string | null
          accepted_at?: string | null
          last_sent_at?: string
          resend_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['team_invitations']['Insert']>
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          event_id: string
          user_id: string | null
          registration_id: string | null
          invitation_id: string | null
          name: string
          email: string
          role: 'leader' | 'member'
          status: 'pending' | 'accepted' | 'declined' | 'removed'
          college: string | null
          student_id_card: string | null
          phone: string | null
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          event_id: string
          user_id?: string | null
          registration_id?: string | null
          invitation_id?: string | null
          name: string
          email: string
          role?: 'leader' | 'member'
          status?: 'pending' | 'accepted' | 'declined' | 'removed'
          college?: string | null
          student_id_card?: string | null
          phone?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      register_for_event: {
        Args: { p_event_id: string }
        Returns: Record<string, unknown>
      }
      cancel_registration: {
        Args: { p_registration_id: string }
        Returns: Record<string, unknown>
      }
      submit_payment_submission: {
        Args: {
          p_registration_id: string
          p_transaction_reference: string
          p_screenshot_url?: string | null
          p_notes?: string | null
        }
        Returns: Record<string, unknown>
      }
      review_payment_submission: {
        Args: {
          p_payment_id: string
          p_decision: string
          p_notes?: string | null
        }
        Returns: Record<string, unknown>
      }
      create_payment_order: {
        Args: {
          p_registration_id: string
          p_provider?: string
          p_idempotency_key?: string | null
        }
        Returns: Record<string, unknown>
      }
      verify_payment_order: {
        Args: {
          p_order_id: string
          p_provider_payment_id: string
          p_provider_signature: string
          p_provider_order_id?: string | null
        }
        Returns: Record<string, unknown>
      }
      record_payment_failure: {
        Args: {
          p_order_id: string
          p_error_code: string
          p_error_description: string
        }
        Returns: Record<string, unknown>
      }
      check_in_ticket: {
        Args: {
          p_event_id: string
          p_ticket_code_or_payload: string
          p_notes?: string | null
        }
        Returns: Record<string, unknown>
      }
      queue_email: {
        Args: {
          p_recipient_email: string
          p_recipient_name: string
          p_template_type: string
          p_subject: string
          p_payload: Record<string, unknown>
          p_idempotency_key: string
          p_event_id?: string | null
          p_registration_id?: string | null
          p_user_id?: string | null
        }
        Returns: Record<string, unknown>
      }
      send_event_reminders: {
        Args: {
          p_event_id: string
          p_custom_message?: string | null
        }
        Returns: Record<string, unknown>
      }
      resend_registration_pass: {
        Args: {
          p_registration_id: string
        }
        Returns: Record<string, unknown>
      }
    }
    Enums: {
      user_role: UserRole
      event_status: EventStatus
      event_type: EventType
      event_category: EventCategory
      registration_status: RegistrationStatus
      payment_status: PaymentStatus
      order_status: OrderStatus
      check_in_outcome: CheckInOutcome
      email_status: 'pending' | 'sent' | 'failed' | 'disabled'
    }
  }
}
