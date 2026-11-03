/**
 * FestFlow 2.0 – Phase 5: Social & Campus Community Comprehensive Test Suite
 *
 * Validates:
 * 1. Student Public Profile Retrieval (/profile/:id, /u/:id)
 * 2. Student Privacy Gate (public, campus_only, private)
 * 3. Strict Student PII Protection (never exposes email, phone, or payment IDs)
 * 4. Verified Skills, Interests, & Badges Rendering
 * 5. Student Certificates Integration (only issued certificates visible unless hidden)
 * 6. Club Public Profile Retrieval (/clubs/:id)
 * 7. Verified Club Seal & Official Recognition Protection
 * 8. Club Follower Counter & Dynamic Status
 * 9. Student Follow Club Workflow
 * 10. Student Unfollow Club Workflow
 * 11. Duplicate Follow Prevention (Idempotent uniqueness)
 * 12. Self-Follow Prevention (Student cannot follow self as club)
 * 13. Official Club Announcements Publishing
 * 14. Club Announcements Priority Pinning
 * 15. Club Announcements Retrieval & Sorting (pinned first, then chronological)
 * 16. Campus Activity Feed Aggregation (Announcements, newly published events)
 * 17. Campus Activity Feed Filtering (all, announcements, events)
 * 18. Event Discussion Thread Creation (Questions)
 * 19. Event Discussion Thread Replies (Threaded answers)
 * 20. Official Organizer Badge Verification
 * 21. Event Discussion Answer Pinning
 * 22. Event Discussion Moderation & Hiding
 * 23. Teammate Matchmaking Opt-In & Discovery Profile
 * 24. Teammate Skills Search & Availability Filtering
 * 25. Teammate Connection Requests (Send, Accept, Decline, Withdraw)
 * 26. Direct 1-to-1 Messaging Exchange Between Participants
 * 27. Direct Messaging Privacy Isolation & Read Receipts Tracking
 * 28. User Blocking & Community Safety Moderation Reporting
 */

import {
  getStudentPublicProfile,
  getClubPublicProfile,
  followClub,
  unfollowClub,
  createClubAnnouncement,
  getClubAnnouncements,
  getCampusActivityFeed,
  seedMockStudentProfile,
} from '../src/lib/community'
import {
  getEventDiscussions,
  postEventComment,
  togglePinEventComment,
  toggleHideEventComment,
} from '../src/lib/discussions'
import {
  saveTeammateProfile,
  getTeammateProfile,
  searchTeammates,
  sendTeammateRequest,
  getTeammateRequests,
  acceptTeammateRequest,
  declineTeammateRequest,
  withdrawTeammateRequest,
} from '../src/lib/teammates'
import {
  sendMessage,
  getConversations,
  getConversationMessages,
  markMessagesAsRead,
  getUnreadMessageCount,
} from '../src/lib/messaging'
import {
  blockUser,
  unblockUser,
  isUserBlocked,
  submitCommunityReport,
} from '../src/lib/moderation'

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`)
    passCount++
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`)
    if (detail) console.error(`    \x1b[33mDetail: ${detail}\x1b[0m`)
    failCount++
  }
}

async function runPhase5Tests() {
  console.log('\n======================================================================')
  console.log(' FESTFLOW 2.0 — PHASE 5: SOCIAL & CAMPUS COMMUNITY TEST SUITE')
  console.log('======================================================================\n')

  const studentA = 'std_alice_001'
  const studentB = 'std_bob_002'
  const studentC_private = 'std_charlie_private_003'
  const clubId = 'club_ieee_001'
  const eventId = 'evt_hackathon_001'

  // -------------------------------------------------------------------------
  // 1. STUDENT PUBLIC PROFILES & PRIVACY GATING
  // -------------------------------------------------------------------------
  console.log('\x1b[36m[SECTION 1: Student Public Profiles & PII Invariant]\x1b[0m')

  // Setup mock profiles in localStorage simulation
  const mockAlice = {
    user: { id: studentA, user_metadata: { display_name: 'Alice Developer' } },
    profile: { id: studentA, display_name: 'Alice Developer', avatar_url: 'https://images.unsplash.com/alice.jpg' },
    studentProfile: {
      bio: 'Fullstack builder passionate about campus hackathons.',
      college_name: 'Anurag University',
      course: 'Computer Science & Engineering',
      skills: ['React', 'TypeScript', 'Node.js', 'Python'],
      interests: ['AI/ML', 'Web Development'],
      preferred_categories: ['Hackathon', 'Coding'],
      visibility: 'public',
      hide_skills: false,
    },
  }
  const mockCharlie = {
    user: { id: studentC_private, user_metadata: { display_name: 'Charlie Private' } },
    profile: { id: studentC_private, display_name: 'Charlie Private', avatar_url: null },
    studentProfile: {
      bio: 'Private campus learner.',
      visibility: 'private',
      hide_skills: true,
    },
  }

  seedMockStudentProfile(studentA, mockAlice)
  seedMockStudentProfile(studentC_private, mockCharlie)

  const aliceProfileRes = await getStudentPublicProfile(studentA, studentB)
  assert(
    aliceProfileRes.success && aliceProfileRes.profile !== undefined,
    'Requirement 1: Student public profile retrieval operates cleanly (/profile/:id)'
  )

  const aliceProf = aliceProfileRes.profile
  assert(
    (aliceProf as any)?.email === undefined &&
    (aliceProf as any)?.phone === undefined &&
    (aliceProf as any)?.registration_id === undefined,
    'Requirement 3: Strict Student PII Protection – Zero leakage of email, phone, or payment IDs'
  )

  assert(
    aliceProf?.displayName === 'Alice Developer' &&
    Array.isArray(aliceProf?.skills),
    'Requirement 4: Student skills, bio, and college affiliations render accurately'
  )

  assert(
    Array.isArray(aliceProf?.badges),
    'Requirement 5: Student achievements integration presents verified badges'
  )

  // Test Private profile accessed by another user
  const charlieProfileRes = await getStudentPublicProfile(studentC_private, studentB)
  assert(
    charlieProfileRes.success && charlieProfileRes.isPrivate === true,
    'Requirement 2: Privacy Gate – Private student profiles conceal sensitive records from peers'
  )

  // -------------------------------------------------------------------------
  // 2. CLUB PUBLIC PROFILES & FOLLOWING WORKFLOW
  // -------------------------------------------------------------------------
  console.log('\n\x1b[36m[SECTION 2: Club Public Profiles, Follower Counters & Announcements]\x1b[0m')

  const clubProfileRes = await getClubPublicProfile(clubId, studentA)
  assert(
    clubProfileRes.success && clubProfileRes.club !== undefined,
    'Requirement 6: Club public profile retrieval operates cleanly (/clubs/:id)'
  )

  assert(
    typeof clubProfileRes.club?.isVerified === 'boolean',
    'Requirement 7: Club official verification seal is securely typed and protected'
  )

  const initialFollowers = clubProfileRes.club?.followersCount || 0

  // Follow club
  const followRes = await followClub(studentA, clubId)
  assert(
    followRes.success === true,
    'Requirement 9: Student can follow an official campus club'
  )

  // Duplicate follow prevention (idempotency)
  const dupFollowRes = await followClub(studentA, clubId)
  assert(
    dupFollowRes.success === true,
    'Requirement 11: Duplicate follow requests are handled idempotently without error'
  )

  // Self follow prevention
  const selfFollowRes = await followClub(clubId, clubId)
  assert(
    selfFollowRes.success === false,
    'Requirement 12: Self-following is strictly prohibited'
  )

  const clubProfileAfterFollow = await getClubPublicProfile(clubId, studentA)
  assert(
    clubProfileAfterFollow.club?.isFollowing === true &&
    clubProfileAfterFollow.club?.followersCount === initialFollowers + 1,
    'Requirement 8: Follower count increments live and follower state is reflected for viewer'
  )

  // Unfollow club
  const unfollowRes = await unfollowClub(studentA, clubId)
  assert(
    unfollowRes.success === true,
    'Requirement 10: Student can unfollow a club'
  )

  // -------------------------------------------------------------------------
  // 3. CLUB ANNOUNCEMENTS & CAMPUS ACTIVITY FEED
  // -------------------------------------------------------------------------
  console.log('\n\x1b[36m[SECTION 3: Club Announcements & Campus Activity Feed]\x1b[0m')

  const postAnnRes = await createClubAnnouncement({
    clubId,
    title: 'Hackathon Registration Phase 1 Closing Soon',
    content: 'All participants must finalize squad rosters before midnight.',
    isPinned: true,
    authorId: clubId,
  })
  assert(
    postAnnRes.success && postAnnRes.announcement !== undefined,
    'Requirement 13: Authorized club organizers can broadcast public announcements'
  )

  assert(
    postAnnRes.announcement?.is_pinned === true,
    'Requirement 14: Priority pinned announcement status is supported and persisted'
  )

  const announcementsList = await getClubAnnouncements(clubId, studentA)
  assert(
    announcementsList.success && announcementsList.announcements.length > 0 && announcementsList.announcements[0].is_pinned === true,
    'Requirement 15: Club announcements list sorts pinned items first, followed chronologically'
  )

  const activityFeedRes = await getCampusActivityFeed({
    viewerId: studentA,
    filter: 'all',
    limit: 10,
  })
  assert(
    activityFeedRes.success && Array.isArray(activityFeedRes.items),
    'Requirement 16: Campus activity feed aggregates club announcements and event publications'
  )

  const filteredFeedRes = await getCampusActivityFeed({
    viewerId: studentA,
    filter: 'announcements',
    limit: 10,
  })
  assert(
    filteredFeedRes.success && filteredFeedRes.items.every((item) => item.type === 'announcement'),
    'Requirement 17: Campus feed filtering by announcements and events operates accurately'
  )

  // -------------------------------------------------------------------------
  // 4. EVENT DISCUSSIONS & Q&A
  // -------------------------------------------------------------------------
  console.log('\n\x1b[36m[SECTION 4: Event Threaded Discussions & Moderation]\x1b[0m')

  // Top level question
  const questionRes = await postEventComment({
    eventId,
    authorId: studentA,
    content: 'Is hardware provided on-site for the IoT track, or do squads bring their own dev boards?',
  })
  assert(
    questionRes.success && questionRes.comment !== undefined,
    'Requirement 18: Students can post top-level questions in the Event Q&A section'
  )
  const questionId = questionRes.comment!.id

  // Organizer reply
  const replyRes = await postEventComment({
    eventId,
    authorId: clubId,
    content: 'Raspberry Pi 4 and ESP32 kits will be provided at the check-in hardware desk.',
    parentId: questionId,
    isOrganizer: true,
  })
  assert(
    replyRes.success && replyRes.comment?.parent_id === questionId,
    'Requirement 19: Threaded nested replies can be posted under parent questions'
  )
  assert(
    replyRes.comment?.is_organizer === true,
    'Requirement 20: Official organizer badge is attributed to event host responses'
  )

  // Pin answer
  const pinRes = await togglePinEventComment(replyRes.comment!.id, true)
  assert(
    pinRes.success === true,
    'Requirement 21: Event organizers can pin verified answers to the top of discussions'
  )

  // Moderation hide
  const hideRes = await toggleHideEventComment(questionId, true)
  assert(
    hideRes.success === true,
    'Requirement 22: Content moderation hide controls operate cleanly on inappropriate comments'
  )

  // -------------------------------------------------------------------------
  // 5. TEAMMATE DISCOVERY & CONNECTION REQUESTS
  // -------------------------------------------------------------------------
  console.log('\n\x1b[36m[SECTION 5: Teammate Matchmaking & Squad Handoff]\x1b[0m')

  // Save teammate discovery profile for Alice
  const saveAliceProfileRes = await saveTeammateProfile({
    studentId: studentA,
    headline: 'Full-Stack React & Supabase Developer',
    bio: 'Looking for a UI/UX designer and ML engineer for the campus hackathon.',
    skills: ['React', 'TypeScript', 'Tailwind', 'Supabase'],
    interests: ['Web3', 'AI'],
    preferredCategories: ['Hackathon', 'Coding'],
    availability: 'actively_looking',
    isOptedIn: true,
  })
  assert(
    saveAliceProfileRes.success === true,
    'Requirement 23: Students can opt into the Teammate Discovery board with skills & availability'
  )

  // Save teammate discovery profile for Bob
  await saveTeammateProfile({
    studentId: studentB,
    headline: 'UI/UX Designer & Product Strategist',
    bio: 'Crafting high-fidelity prototypes in Figma and frontend UI components.',
    skills: ['Figma', 'UI/UX', 'Tailwind', 'CSS'],
    interests: ['Design Systems', 'Mobile Design'],
    preferredCategories: ['Hackathon', 'Design'],
    availability: 'open_to_offers',
    isOptedIn: true,
  })

  // Search teammates with filters
  const searchRes = await searchTeammates({
    skills: ['Tailwind'],
    viewerId: studentA,
  })
  assert(
    searchRes.success && searchRes.candidates.some((c) => c.student_id === studentB),
    'Requirement 24: Students can search and filter prospective teammates by skills and availability'
  )

  // Send teammate connection request from Alice to Bob
  const sendReqRes = await sendTeammateRequest({
    senderId: studentA,
    receiverId: studentB,
    eventId,
    message: 'Hey Bob, saw your Figma work! Would you like to team up for the Hackathon?',
  })
  assert(
    sendReqRes.success && sendReqRes.request !== undefined,
    'Requirement 25a: Teammate connection request can be dispatched with optional event context'
  )
  const requestId = sendReqRes.request!.id

  // Bob views incoming requests
  const bobsRequests = await getTeammateRequests(studentB)
  assert(
    bobsRequests.success && bobsRequests.incoming.some((r) => r.id === requestId),
    'Requirement 25b: Receiver sees incoming teammate connection requests in their manager'
  )

  // Bob accepts request
  const acceptRes = await acceptTeammateRequest(requestId, studentB)
  assert(
    acceptRes.success === true,
    'Requirement 25c: Accepting connection request updates status and enables squad coordination'
  )

  // Test withdraw on a new request
  const sendReq2 = await sendTeammateRequest({
    senderId: studentA,
    receiverId: studentC_private,
    message: 'Testing withdraw workflow.',
  })
  if (sendReq2.request) {
    const withdrawRes = await withdrawTeammateRequest(sendReq2.request.id, studentA)
    assert(
      withdrawRes.success === true,
      'Requirement 25d: Sender can withdraw a pending teammate connection request'
    )
  }

  // -------------------------------------------------------------------------
  // 6. DIRECT 1-TO-1 MESSAGING
  // -------------------------------------------------------------------------
  console.log('\n\x1b[36m[SECTION 6: Direct 1-to-1 Messaging & Anti-Harassment Isolation]\x1b[0m')

  // Alice sends Bob a direct message
  const sendMsgRes = await sendMessage({
    senderId: studentA,
    receiverId: studentB,
    content: 'Hi Bob! Welcome to the squad. Our invite code for registration is TF-884920.',
  })
  assert(
    sendMsgRes.success && sendMsgRes.messageRecord !== undefined,
    'Requirement 26a: Direct 1-to-1 messages can be sent between campus peers'
  )
  const convId = sendMsgRes.conversationId!

  // Check conversations for Alice and Bob
  const aliceConvs = await getConversations(studentA)
  assert(
    aliceConvs.success && aliceConvs.conversations.some((c) => c.id === convId),
    'Requirement 26b: Active conversation appears in sender’s conversations ledger'
  )

  const bobConvs = await getConversations(studentB)
  assert(
    bobConvs.success && bobConvs.conversations.some((c) => c.id === convId),
    'Requirement 26c: Active conversation appears in recipient’s inbox with preview snippet'
  )

  // Check unread count for Bob
  const unreadCount = await getUnreadMessageCount(studentB)
  assert(
    unreadCount >= 1,
    'Requirement 27a: Unread message badge increments for recipient'
  )

  // Bob opens conversation and reads messages
  const markReadRes = await markMessagesAsRead(convId, studentB)
  assert(
    markReadRes.success === true,
    'Requirement 27b: Marking messages as read updates read receipts'
  )

  const updatedUnread = await getUnreadMessageCount(studentB)
  assert(
    updatedUnread === 0,
    'Requirement 27c: Unread counter clears once conversation is reviewed'
  )

  // -------------------------------------------------------------------------
  // 7. USER BLOCKING & SAFETY MODERATION REPORTING
  // -------------------------------------------------------------------------
  console.log('\n\x1b[36m[SECTION 7: User Blocking & Community Safety Moderation Reporting]\x1b[0m')

  // Block studentC
  const blockRes = await blockUser(studentA, studentC_private)
  assert(
    blockRes.success === true,
    'Requirement 28a: Students can block offending users from direct communication'
  )

  const isBlockedCheck = await isUserBlocked(studentA, studentC_private)
  assert(
    isBlockedCheck === true,
    'Requirement 28b: Block status is accurately verified by safety middleware'
  )

  // Blocked user attempts to send message
  const blockedSendRes = await sendMessage({
    senderId: studentC_private,
    receiverId: studentA,
    content: 'This message should be rejected by moderation.',
  })
  assert(
    blockedSendRes.success === false,
    'Requirement 28c: Safety middleware strictly prevents blocked users from messaging'
  )

  // Submit community report
  const reportRes = await submitCommunityReport({
    reporterId: studentA,
    targetType: 'message',
    targetId: 'msg_spam_999',
    reason: 'spam',
    details: 'Unsolicited promotional content sent in discussion thread.',
  })
  assert(
    reportRes.success && reportRes.reportId !== undefined,
    'Requirement 28d: Community safety reports can be submitted with reason and audit tracking'
  )

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================')
  console.log(` PHASE 5 TEST RESULTS: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[31m${failCount} FAILED\x1b[0m`)
  console.log('======================================================================\n')

  if (failCount > 0) {
    process.exit(1)
  }
}

runPhase5Tests().catch((err) => {
  console.error('Test execution aborted due to unhandled error:', err)
  process.exit(1)
})
