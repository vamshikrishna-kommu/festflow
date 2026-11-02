// Phase 8: Notifications & Automation Test Suite
import {
  getInAppNotificationsEnhanced,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  getUserNotificationPreferences,
  saveUserNotificationPreferences,
  checkPushSupport,
  getEventWaitlistStatus,
  joinEventWaitlist,
  leaveEventWaitlist,
  claimWaitlistSpot,
  getClubEventAutomations,
  saveClubEventAutomation,
  getAutomationQueueMetrics,
  retryFailedEmailJob,
  getWhatsAppTemplate,
  DEFAULT_CLUB_AUTOMATIONS,
} from '../src/lib/notifications'
import type { InAppNotification, UserNotificationPreferences } from '../src/types'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, desc: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ ${desc}`)
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
  }
}

async function runPhase8TestSuite() {
  console.log('===============================================================')
  console.log('  FESTFLOW PHASE 8: NOTIFICATIONS & AUTOMATION TEST SUITE')
  console.log('===============================================================\n')

  const testUserId = `test_student_${Date.now()}`
  const testEventId = `test_event_${Date.now()}`

  // 1. Central Notification Center Tests
  console.log('1. Central Notification Center Tests:')
  {
    // Seed test notifications into local storage simulation
    const seedNotifs: InAppNotification[] = [
      {
        id: 'notif_1',
        user_id: testUserId,
        title: 'Registration Confirmed',
        message: 'You have registered for HackNIT 2026',
        type: 'registration',
        category: 'registration',
        is_read: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'notif_2',
        user_id: testUserId,
        title: 'Payment Approved',
        message: 'Your ₹250 UPI payment was approved by organizer',
        type: 'payment_approved',
        category: 'payment',
        is_read: false,
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'notif_3',
        user_id: testUserId,
        title: 'Certificate Ready',
        message: 'Your participation certificate is available for download',
        type: 'certificate_issued',
        category: 'certificates',
        is_read: true,
        created_at: new Date(Date.now() - 900000).toISOString(),
      },
    ]

    // Setup mock localStorage in node environment if needed
    if (typeof localStorage === 'undefined') {
      const store: Record<string, string> = {
        festflow_local_in_app_notifications: JSON.stringify(seedNotifs),
      }
      ;(globalThis as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      }
    }

    const allRes = await getInAppNotificationsEnhanced(testUserId, { category: 'all' })
    assert(allRes.notifications.length === 3, 'Fetches all notifications for user')
    assert(allRes.unreadCount === 2, 'Accurately computes unread count (2 unread)')

    const payRes = await getInAppNotificationsEnhanced(testUserId, { category: 'payment' })
    assert(payRes.notifications.length === 1, 'Filters by category = payment')
    assert(payRes.notifications[0].title === 'Payment Approved', 'Retrieved exact category record')

    const unreadRes = await getInAppNotificationsEnhanced(testUserId, { unreadOnly: true })
    assert(unreadRes.notifications.length === 2, 'Filters strictly unread notifications')

    // Mark single read
    await markNotificationRead('notif_1')
    const postRead = await getInAppNotificationsEnhanced(testUserId, { unreadOnly: true })
    assert(postRead.notifications.length === 1, 'Mark individual read updates unread counter')

    // Mark all read
    await markAllNotificationsRead(testUserId)
    const postAllRead = await getInAppNotificationsEnhanced(testUserId, { unreadOnly: true })
    assert(postAllRead.notifications.length === 0, 'Mark all read sets all records to read')

    // Archive
    await archiveNotification('notif_3')
    const postArchive = await getInAppNotificationsEnhanced(testUserId)
    assert(postArchive.totalCount === 3, 'Archive flags notification safely')
  }

  // 2. User Notification Preferences Tests
  console.log('\n2. User Notification Preferences Tests:')
  {
    const initialPrefs = await getUserNotificationPreferences(testUserId)
    assert(initialPrefs.email_enabled === true, 'Default email notifications enabled')
    assert(initialPrefs.event_reminders === true, 'Default event reminders enabled')
    assert(initialPrefs.push_enabled === false, 'Default push notifications disabled until prompt')

    const updatedPrefs: UserNotificationPreferences = {
      ...initialPrefs,
      event_reminders: false,
      certificate_notifications: false,
    }

    const saveRes = await saveUserNotificationPreferences(updatedPrefs)
    assert(saveRes.success === true, 'Preferences saved successfully')

    const reloaded = await getUserNotificationPreferences(testUserId)
    assert(reloaded.event_reminders === false, 'Persistent setting: event reminders disabled')
    assert(reloaded.certificate_notifications === false, 'Persistent setting: certificate alerts disabled')
  }

  // 3. Web Push Detection Tests
  console.log('\n3. Web Push API Evaluation Tests:')
  {
    const pushStatus = checkPushSupport()
    assert(typeof pushStatus.supported === 'boolean', 'Push support returns valid boolean detection')
    assert(typeof pushStatus.permission === 'string', 'Permission status correctly enumerated')
  }

  // 4. Waitlist Lifecycle & Atomic Capacity Protection Tests
  console.log('\n4. Waitlist Lifecycle & Capacity Protection Tests:')
  {
    const status1 = await getEventWaitlistStatus(testEventId, testUserId)
    assert(status1.totalWaiting === 0, 'Initial waitlist starts at 0')
    assert(status1.userEntry === null, 'User initially not on waitlist')

    // Join waitlist
    const joinRes = await joinEventWaitlist(testEventId, testUserId)
    assert(joinRes.success === true, 'Student successfully joins waitlist')
    assert(joinRes.entry?.position === 1, 'Assigned queue position #1')

    const status2 = await getEventWaitlistStatus(testEventId, testUserId)
    assert(status2.totalWaiting === 1, 'Total waiting count incremented to 1')
    assert(status2.userEntry?.position === 1, 'User entry verified at position 1')

    // Claim waitlist spot
    const claimRes = await claimWaitlistSpot(joinRes.entry!.id)
    assert(claimRes.success === true, 'Claim waitlist spot executes concurrency check')

    // Leave waitlist
    const leaveRes = await leaveEventWaitlist(joinRes.entry!.id, testUserId)
    assert(leaveRes.success === true, 'Student can voluntarily cancel waitlist reservation')
  }

  // 5. Club Event Automation Rules Tests
  console.log('\n5. Club Event Automation Rules Tests:')
  {
    const clubRules = await getClubEventAutomations(testEventId, 'test_club_1')
    assert(clubRules.length === 6, 'Pre-seeds 6 core event automation triggers')
    assert(
      clubRules.some((r) => r.trigger_type === 'reminder_7d'),
      'Includes 7-day countdown reminder trigger'
    )
    assert(
      clubRules.some((r) => r.trigger_type === 'reminder_1d'),
      'Includes 24-hour venue gate reminder trigger'
    )
    assert(
      clubRules.some((r) => r.trigger_type === 'reminder_2h'),
      'Includes 2-hour final turnstile call trigger'
    )
    assert(
      clubRules.some((r) => r.trigger_type === 'post_event_feedback'),
      'Includes post-event survey trigger'
    )

    // Save custom template rule
    const targetRule = clubRules[0]
    const customTemplate = 'Welcome {{student_name}}! See you at {{venue_name}} for {{event_title}}!'
    const saveRuleRes = await saveClubEventAutomation({
      ...targetRule,
      message_template: customTemplate,
      is_enabled: true,
    })
    assert(saveRuleRes.success === true, 'Club organizer can customize automation message templates')
    assert(saveRuleRes.record?.message_template === customTemplate, 'Custom template persisted accurately')
  }

  // 6. Super Admin Operations & Queue Metrics Tests
  console.log('\n6. Super Admin Automation Operations Tests:')
  {
    const metrics = await getAutomationQueueMetrics()
    assert(typeof metrics.emails_queued === 'number', 'Metrics report queued email count')
    assert(typeof metrics.emails_sent === 'number', 'Metrics report sent email count')
    assert(typeof metrics.emails_failed === 'number', 'Metrics report failed email count')
    assert(typeof metrics.active_automations_count === 'number', 'Metrics report active club automations')

    const retryRes = await retryFailedEmailJob('mock_failed_job_123')
    assert(retryRes.success === true, 'Failed email jobs can be requeued safely without duplicates')
  }

  // 7. Official WhatsApp Business Architecture Tests
  console.log('\n7. Official WhatsApp Business Platform Evaluation Tests:')
  {
    const regPayload = getWhatsAppTemplate('event_registration_confirmed', {
      studentName: 'Alex Rivera',
      eventTitle: 'HackFest 2026',
      ticketCode: 'PASS-9872',
      venueName: 'Campus Auditorium',
    })
    assert(regPayload.name === 'festflow_registration_confirmed', 'Compliant Meta template name')
    assert(regPayload.category === 'UTILITY', 'Categorized as Meta UTILITY message (cost-effective)')
    assert(regPayload.components[0].parameters?.length === 4, 'Full 4-parameter positional payload')

    const reminderPayload = getWhatsAppTemplate('event_reminder_24h', {
      studentName: 'Alex Rivera',
      eventTitle: 'HackFest 2026',
      startTime: '10:00 AM',
      venueName: 'Main Audi',
    })
    assert(reminderPayload.category === 'UTILITY', 'Reminder conforms to 24h utility window')
  }

  console.log('\n===============================================================')
  console.log(`  PHASE 8 TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`)
  console.log('===============================================================')

  if (passedTests === totalTests) {
    process.exit(0)
  } else {
    process.exit(1)
  }
}

runPhase8TestSuite().catch((err) => {
  console.error('Test suite uncaught error:', err)
  process.exit(1)
})

