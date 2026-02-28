# PROJECT: Digital Tambayan (Master Context)

## 0. Current Session Status
- **Current Goal:** Session 1.13: Nickname System & Berto AI Implementation
- **Last Completed:** Personal chat display name now shows the other user's nickname when set
- **Next Steps:** Test the nickname system and verify real-time updates work properly

## 1. Core Identity & Manifest
- **Bot Name:** Berto (configured in `BOT_NAME` constant - single source of truth)
- **Tone/Persona:** Taglish Tambay (Local/Casual)
- **Primary Trigger:** @Berto

## 2. Technical Stack & State
- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Email/Password
- **Real-Time:** [ENABLED] Supabase Realtime for messages, room_members, room_member_nicknames tables
- **User Flow:** User registers with Email, Password, and Username -> Trigger creates entry in `profiles`.

- `src/config`: Configuration/Manifests.
- `src/components/chat`: UI presentation only.
- `src/components/auth`: Login/Register components.
- `src/components/admin`: Admin dashboard components (AdminDashboard, RoomManager, UserManager)
- `src/hooks`: All stateful/socket logic.
- `src/lib`: Database/External API services.
- `src/lib/adminService.ts`: Admin operations (room/user management)
- `src/utils/supabase`: Client/Server Supabase factories.

## 3. Chat Room Types

### Personal Chats (DMs)
- Auto-created when clicking on a user's profile
- No admin concept - both participants have equal permissions
- Display name shows the other participant's username OR their nickname (if set)
- Users can set nicknames for each other - only visible to the setter

### Group Chats
- Created via dedicated "Create Group" button
- Has admin/member role system
- Display name shows group name (if named) or member list (if unnamed)
- Users can set nicknames for other members - only visible to the setter

## 4. Current Database Schema
- `profiles`: `id` (PK), `username` (unique), `email` (unique), `is_admin`, `updated_at`
- `rooms`: `id` (PK), `slug` (unique), `name`, `owner_id`, `is_personal`, `display_name`, `created_at`
- `messages`: `id` (PK), `room_id` (FK), `user_id` (FK, nullable), `sender_name`, `content`, `is_bot`, `is_system`, `created_at`
- `room_members`: `id` (PK), `room_id` (FK), `user_id` (FK), `role` ('owner', 'admin', 'member'), `joined_at`, `added_by`
- `chat_settings`: `id` (PK), `enable_message_deletion`, `deletion_threshold_minutes`, `created_at`, `updated_at`
- `room_member_nicknames`: `id` (PK), `room_id` (FK), `target_user_id` (FK), `setter_user_id` (FK), `nickname` (TEXT), `created_at`, `updated_at` - stores per-user nicknames for room members

### Database Functions (in migrations)
- `get_user_rooms(p_user_id)` - Get all rooms for a user with metadata
- `get_or_create_personal_chat(p_user1_id, p_user2_id)` - Get or create DM between users
- `leave_room(p_room_id, p_user_id)` - Leave room with auto-promotion and cleanup
- `get_room_display_name(p_room_id, p_current_user_id)` - Get display name for room (now includes nickname support for personal chats)
- `create_group_chat(p_name, p_creator_id, p_member_ids)` - Create group chat with members
- `get_room_members(room_id)` - Get all members of a room with usernames
- `add_room_admin(p_room_id, p_user_id, p_requester_id)` - Promote member to admin
- `remove_room_admin(p_room_id, p_user_id, p_requester_id)` - Demote admin to member
- `update_room_name(p_room_id, p_name, p_requester_id)` - Update room name
- `add_member_to_room(p_room_id, p_user_id, p_requester_id)` - Add member to room
- `remove_member_from_room(p_room_id, p_user_id, p_requester_id)` - Remove member from room
- `clear_room_messages(p_room_id)` - Clear all messages in a room (requires Admin/Owner or Global Admin)
- `get_member_nicknames(p_room_id, p_setter_user_id)` - Get all nicknames set by a user in a room
- `set_member_nickname(p_room_id, p_target_user_id, p_nickname, p_setter_user_id)` - Set/update a nickname
- `delete_member_nickname(p_room_id, p_target_user_id, p_setter_user_id)` - Delete a nickname

## 5. Permission System (Group Chats Only)

| Action | Member | Admin |
|--------|--------|-------|
| Add/Remove Members | ❌ | ✅ |
| Add/Remove Admins | ❌ | ✅ |
| Change Room Name | ✅ | ✅ |
| Change Permissions | ❌ | ✅ |
| Leave Room | ✅ | ✅ |
| Delete Room | ❌ | ✅ (Owner only) |

### Special Rules
- **Last Admin Protection**: Cannot remove/demote the last admin
- **Auto-Promotion**: When last admin leaves, longest-standing member becomes admin
- **Room Deletion**: When last member leaves, room is automatically deleted
- **Personal Chat Equality**: Both participants have equal permissions
- **Nicknames**: Each user can set their own private nicknames for other members (not shared)

## 6. Development Log (Progress Tracker)
- [x] Session 1.1: Project Init & Manifest.
- [x] Session 1.2: Email/Password Auth & Profile Linkage.
- [x] Session 1.2.5: Auth Bug Fixes & User Settings.
- [x] Session 1.3: Persistent Chat Storage.
- [x] Session 1.4: Real-time Chat Messaging Engine.
- [x] Session 1.5: Chat UI, Hooks & Admin 'Clear History'.
- [x] Session 1.6: Typing Indicator & System Messages.
- [x] Session 1.7: Berto Bot Stub Implementation.
- [x] Session 1.8: Admin Account Management System (Room Manager, User Manager, Settings Tabs)
- [x] Session 1.9: Chat Room Improvements
- [x] Session 1.10: Fix Sidebar Realtime Updates
  - [x] Added subscribeToMessagesForRooms in chatService.ts
  - [x] Updated RoomSidebar to subscribe to message changes
- [x] Session 1.11: Sidebar Metadata & Admin Enhancements
  - [x] Updated `get_user_rooms` to include last message content and sender
  - [x] Added `clear_room_messages` security-defined RPC for robust chat clearing
  - [x] Fixed "Not Authorized" bug for Website Admins clearing any chat room
  - [x] Implemented `UI_STRINGS` manifest in `src/config/uiStrings.ts`
  - [x] Improved empty chat state UI ("No messages here yet")
- [x] Session 1.12: Unread Message System & User Search
  - [x] Added unread message tracking with localStorage persistence
  - [x] Added user search in sidebar to start direct messages
  - [x] Fixed chat scroll issue - chat now scrolls to bottom properly including system messages
  - [x] Added UI strings for user search ("Users", "Start a conversation")
  - [x] Updated typing indicator to clear on room change
- [x] Session 1.13: Nickname System & Room Deletion
  - [x] Added `room_member_nicknames` table for storing per-user nicknames
  - [x] Implemented nickname CRUD functions in database
  - [x] Added nickname editing UI in MembersList (both Personal and Group panels)
  - [x] Updated message display to show nicknames instead of usernames
  - [x] Added real-time subscription for nickname changes
  - [x] Added room deletion feature (owners can delete rooms)
  - [x] Updated personal chat display name to show other user's nickname
  - [x] Added multiple real-time subscriptions (room deletions, memberships, message deletions)

## 7. Active Constraints
- Auth: Custom Sign-up/Login forms required.
- Admin: Manually toggle `is_admin` in Supabase dashboard for the tester account.
- Berto Bot: Fully integrated with Gemini API (`gemma-3-27b-it`). Support for nickname-aware context (perspectives).
- **Schema Consolidated**: Chat room improvements are in `00000_initial_schema.sql` and separate migration files

## 8. Key Files Reference
- `src/config/botManifest.ts` - Bot configuration (BOT_NAME constant, trigger, placeholder responses, system prompt)
- `src/config/uiStrings.ts` - Centralized UI strings manifest (includes nickname-related strings)
- `src/hooks/useChat.ts` - Chat state management with real-time subscriptions
- `src/hooks/useTypingIndicator.ts` - Typing indicator broadcast logic
- `src/lib/chatService.ts` - Message CRUD, real-time subscriptions, room management, Berto bot integration logic
- `src/lib/adminService.ts` - Admin operations, room member management, permission checks, nickname management
- `src/lib/aiService.ts` - (NEW) AI service for Berto bot integration
- `src/components/Dashboard.tsx` - Main dashboard with sidebar layout, chat, settings modal, nickname handling
- `src/components/chat/RoomSidebar.tsx` - Left sidebar showing all user's rooms with real-time updates
- `src/components/chat/MembersList.tsx` - Room members display, management, nickname editing UI
- `src/components/chat/ChatBox.tsx` - Message display with nickname support
- `src/components/chat/MessageItem.tsx` - Individual message with nickname display
- `src/components/chat/CreateGroupModal.tsx` - Modal for creating group chats
- `src/components/chat/UserProfileModal.tsx` - Modal for viewing user profile and starting DMs
- `src/components/admin/AdminDashboard.tsx` - Admin dashboard with tabs for Rooms and Users
- `supabase/migrations/00000_initial_schema.sql` - Complete database schema with all functions
- `supabase/migrations/20260224_chat_room_improvements.sql` - Chat improvements including nickname support in get_room_display_name
- `supabase/migrations/20260228_nickname_system.sql` - Nickname system migration
- `plans/nickname-system-implementation.md` - Detailed implementation plan for nickname system
- `plans/chat-room-improvements.md` - Detailed implementation plan for Session 1.9
- `plans/fix-sidebar-realtime-updates.md` - Implementation plan for fixing sidebar realtime updates

## 9. System Messages Events
- User joins room: "{username} joined the chat"
- User leaves room: "{username} left the chat"
- User is removed: "{username} was removed by {remover}"
- User is promoted to admin: "{username} is now an admin"
- User is demoted from admin: "{username} is no longer an admin"
- Room name changed: "Room name changed to '{name}' by {username}"
- Nickname set: "{username}'s nickname was set to {nickname}"

## 10. Files Created/Modified in Session 1.13 (Nickname System & Room Deletion)

### New Files Created
- `src/lib/aiService.ts` - AI service for Berto bot (Gemini API integration)
- `supabase/migrations/20260228_nickname_system.sql` - Database migration for nickname system
- `plans/nickname-system-implementation.md` - Implementation plan document

### Modified Files
- `supabase/migrations/20260224_chat_room_improvements.sql` - Updated get_room_display_name to include nickname support
- `src/types/database.ts` - Added RoomMemberNickname type
- `src/config/uiStrings.ts` - Added nickname-related UI strings
- `src/lib/adminService.ts` - Added deleteRoom, getMemberNicknames, setMemberNickname, deleteMemberNickname methods
- `src/lib/chatService.ts` - Added Berto AI integration (triggerBotResponse, sendTestSystemMessage), subscribeToNicknames, subscribeToRoomDeletions, subscribeToRoomMemberships, subscribeToMessageDeletionsForRooms, subscribeToRoomMembers
- `src/components/Dashboard.tsx` - Added nickname loading, subscription, passing nicknames to ChatBox
- `src/components/chat/ChatBox.tsx` - Pass nicknames to MessageItem
- `src/components/chat/MembersList.tsx` - Full nickname editing UI, room deletion for owners
- `src/components/chat/MessageItem.tsx` - Display nicknames instead of usernames in messages
- `src/components/chat/RoomSidebar.tsx` - Added real-time subscriptions for room deletions and memberships
- `src/config/botManifest.ts` - Refactored to use BOT_NAME constant (single source of truth)

## 11. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Dashboard.tsx                         │
├────────────────┬─────────────────────────────┬───────────────┤
│  RoomSidebar   │         Chat Area           │  MembersList  │
│                │                             │               │
│  - Personal    │  ┌───────────────────────┐  │               │
│    Chats       │  │   ChatBox             │  │  - Members    │
│  - Group       │  │   (messages with      │  │  - Promote    │
│    Chats       │  │    nicknames)         │  │  - Demote     │
│  - Create      │  └───────────────────────┘  │  - Remove     │
│    Group       │  ┌───────────────────────┐  │  - Leave      │
│  - User Search │  │   ChatInput           │  │  - Delete     │
│                │  └───────────────────────┘  │    Room       │
│  - Unread      │                            │  - Nicknames  │
│    Indicators  │                            │               │
└────────────────┴────────────────────────────┴───────────────┘
```

## 12. Service Layer API Reference

### aiService
| Method | Description |
|--------|-------------|
| `generateResponse(formattedContext)` | Generates AI response from Gemini API using the configured system prompt |

### chatService
| Method | Description |
|--------|-------------|
| `sendMessage(roomId, userId, senderName, content)` | Send a message to a room |
| `getMessages(roomId, limit)` | Get last N messages for a room |
| `deleteMessage(messageId)` | Delete a specific message |
| `clearChat(roomId)` | Delete all messages in a room |
| `getUserRooms(userId)` | Get all rooms for a user with metadata |
| `getOrCreatePersonalChat(currentUserId, otherUserId)` | Get or create DM |
| `createGroupChat(name, memberIds, creatorId)` | Create a group chat |
| `leaveRoom(roomId, userId)` | Leave a room |
| `getRoomDisplayName(roomId, currentUserId)` | Get display name for room (includes nickname for personal chats) |
| `getRoomById(roomId)` | Get room by ID |
| `sendSystemMessage(roomId, content)` | Send system message |
| `subscribeToMessages(roomId, onInsert, onDelete)` | Real-time subscription |
| `subscribeToUserRooms(userId, onRoomChange)` | Room list changes |
| `subscribeToMessagesForRooms(roomIds, onMessage)` | Subscribe to messages for all rooms |
| `subscribeToNicknames(roomId, setterUserId, onChange)` | Subscribe to nickname changes |
| `subscribeToRoomDeletions(userId, onDelete)` | Subscribe to room deletions |
| `subscribeToRoomMemberships(userId, onChange)` | Subscribe to membership changes |
| `subscribeToRoomMembers(roomId, onChange)` | Subscribe to room member changes |
| `clear_room_messages(roomId)` | Securely clear all messages (RPC) |

### adminService
| Method | Description |
|--------|-------------|
| `getAllRooms()` | Get all rooms (admin) |
| `createRoom(slug, name, ownerId)` | Create room (admin) |
| `getAllUsers()` | Get all users (admin) |
| `deleteUser(userId)` | Delete user (admin) |
| `getChatSettings()` | Get chat settings |
| `updateChatSettings(settings)` | Update chat settings |
| `getRoomMembers(roomId)` | Get members of a room |
| `getAvailableUsersForRoom(roomId)` | Get users not in room |
| `canManageMembers(roomId, userId)` | Check permission |
| `canManageAdmins(roomId, userId)` | Check permission |
| `canChangeRoomName(roomId, userId)` | Check permission |
| `addRoomAdmin(roomId, userId, requesterId)` | Promote to admin |
| `removeRoomAdmin(roomId, userId, requesterId)` | Demote from admin |
| `updateRoomName(roomId, name, requesterId)` | Update room name |
| `addMemberToRoom(roomId, userId, requesterId)` | Add member |
| `removeMemberFromRoom(roomId, userId, requesterId)` | Remove member |
| `deleteRoom(roomId, userId)` | Delete room (owner only) |
| `getMemberNicknames(roomId, setterUserId)` | Get nicknames set by user in room |
| `setMemberNickname(roomId, targetUserId, nickname, setterUserId)` | Set/update nickname |
| `deleteMemberNickname(roomId, targetUserId, setterUserId)` | Delete nickname |

## 13. Nickname System

### How It Works
- Each user can set private nicknames for other members in any room
- Nicknames are only visible to the setter (not shared with other users)
- Different rooms can have different nicknames for the same person
- Displayed in:
  - Messages (shows nickname instead of username)
  - Member list (shows nickname with username as subtitle)
  - Personal chat title (shows other user's nickname)
  - **AI Context** (Berto sees users by their nicknames!)

### Database
- `room_member_nicknames` table stores: (room_id, target_user_id, setter_user_id) -> nickname
- Unique constraint prevents duplicate nicknames for same user/room/setter combination
- RLS policies ensure users can only see/edit their own nicknames

## 14. Berto AI Bot

### Configuration (in `botManifest.ts`)
- **Model:** gemma-3-27b-it (via Google Gemini API)
- **Trigger:** @Berto (mention trigger)
- **Context:** Last 10 messages (configurable)
- **Cooldown:** 10 seconds between responses (configurable)
- **Logging:** Console logging for API requests/responses (toggleable in manifest)
- **System Prompt:** Customizable - currently set to "You are Berto, an observant friend in a group chat..."

### How It Works
1. User mentions @Berto in a message (configured in `BOT_CONFIG.mentionTrigger`)
2. Message is saved to database
3. Bot checks for @Berto mention in `chatService.sendMessage`
4. If found, triggers `triggerBotResponse(roomId, triggerUserId)`
5. Fetches recent messages for context, using the triggering user's set nicknames for all participants
6. Calls Gemini API using `aiService.generateResponse`
7. Saves AI response as bot message (sender name from `BOT_CONFIG.name`)

### Environment Variables
- `NEXT_PUBLIC_GEMINI_API_KEY` - Required for AI responses
