import type { Event } from '@/types'

// Deprecated: All screens query live Supabase data. Retained as empty array for type stability.
export const MOCK_EVENTS: Event[] = []
export const FEATURED_EVENTS: Event[] = []

export const EVENT_CATEGORIES = [
  { value: 'all',       label: 'All Events' },
  { value: 'hackathon', label: 'Hackathons'  },
  { value: 'cultural',  label: 'Cultural'    },
  { value: 'music',     label: 'Music'       },
  { value: 'tech',      label: 'Tech'        },
  { value: 'workshop',  label: 'Workshops'   },
  { value: 'sports',    label: 'Sports'      },
  { value: 'seminar',   label: 'Seminars'    },
  { value: 'gaming',    label: 'Gaming'      },
  { value: 'art',       label: 'Art'         },
] as const

export type CategoryFilter = (typeof EVENT_CATEGORIES)[number]['value']
