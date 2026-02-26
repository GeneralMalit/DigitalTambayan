# PROJECT: Digital Tambayan (Master Context)

## 0. Current Session Status
- **Current Goal:** Session 1.12: Unread Message System & User Search
- **Last Completed:** Fixed chat scroll issue - chat now scrolls to bottom properly including system messages
- **Next Steps:** Fix the unread message tracking system and polish the user search feature.

## 1. Core Identity & Manifest
- **Bot Name:** Berto
- **Tone/Persona:** Taglish Tambay (Local/Casual)
- **Primary Trigger:** @Berto

## 2. Technical Stack & State
- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Email/Password
- **Real-Time:** [ENABLED] Supabase Realtime for messages table
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
- Display name shows the other participant's username

### Group Chats
- Created via dedicated "Create Group" button
- Has admin/member role system
- Display name shows group name (if named) or member list (if unnamed)

## 4. Current Database Schema
- `profiles`: `id` (PK), `username` (unique), `email` (unique), `is_admin`, `updated_at`
- `rooms`: `id` (PK), `slug` (unique), `name`, `owner_id`, `is_personal`, `display_name`, `created_at`
- `messages`: `id` (PK), `room_id` (FK), `user_id` (FK, nullable), `sender_name`, `content`, `is_bot`, `is_system`, `created_at`
- `room_members`: `id` (PK), `room_id` (FK), `user_id` (FK), `role` ('owner', 'admin', 'member'), `joined_at`, `added_by`
- `chat_settings`: `id` (PK), `enable_message_deletion`, `deletion_threshold_minutes`, `created_at`, `updated_at`

### Database Functions (in 00000_initial_schema.sql)
- `get_user_rooms(p_user_id)` - Get all rooms for a user with metadata
- `get_or_create_personal_chat(p_user1_id, p_user2_id)` - Get or create DM between users
- `leave_room(p_room_id, p_user_id)` - Leave room with auto-promotion and cleanup
- `get_room_display_name(p_room_id, p_current_user_id)` - Get display name for room
- `create_group_chat(p_name, p_creator_id, p_member_ids)` - Create group chat with members
- `get_room_members(room_id)` - Get all members of a room with usernames
- `add_room_admin(p_room_id, p_user_id, p_requester_id)` - Promote member to admin
- `remove_room_admin(p_room_id, p_user_id, p_requester_id)` - Demote admin to member
- `update_room_name(p_room_id, p_name, p_requester_id)` - Update room name
- `add_member_to_room(p_room_id, p_user_id, p_requester_id)` - Add member to room
- `remove_member_from_room(p_room_id, p_user_id, p_requester_id)` - Remove member from room
- `clear_room_messages(p_room_id)` - Clear all messages in a room (requires Admin/Owner or Global Admin)

## 5. Permission System (Group Chats Only)

| Action | Member | Admin |
|--------|--------|-------|
| Add/Remove Members | ❌ | ✅ |
| Add/Remove Admins | ❌ | ✅ |
| Change Room Name | ✅ | ✅ |
| Change Permissions | ❌ | ✅ |
| Leave Room | ✅ | ✅ |

### Special Rules
- **Last Admin Protection**: Cannot remove/demote the last admin
- **Auto-Promotion**: When last admin leaves, longest-standing member becomes admin
- **Room Deletion**: When last member leaves, room is automatically deleted
- **Personal Chat Equality**: Both participants have equal permissions

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

## 7. Active Constraints
- Auth: Custom Sign-up/Login forms required.
- Admin: Manually toggle `is_admin` in Supabase dashboard for the tester account.
- Berto Bot: Currently a STUB - returns placeholder responses when @Berto is mentioned. Ready for future AI integration.
- **Schema Consolidated**: All chat room improvements are in `00000_initial_schema.sql` - no separate migration file needed

## 8. Key Files Reference
- `src/config/botManifest.ts` - Bot configuration (Berto name, trigger, placeholder responses)
- `src/config/uiStrings.ts` - Centralized UI strings manifest
- `src/hooks/useChat.ts` - Chat state management with real-time subscriptions
- `src/hooks/useTypingIndicator.ts` - Typing indicator broadcast logic
- `src/lib/chatService.ts` - Message CRUD, real-time subscriptions, room management, Berto bot stub
- `src/lib/adminService.ts` - Admin operations, room member management, permission checks
- `src/components/Dashboard.tsx` - Main dashboard with sidebar layout, chat, settings modal
- `src/components/chat/RoomSidebar.tsx` - Left sidebar showing all user's rooms
- `src/components/chat/MembersList.tsx` - Room members display and management
- `src/components/chat/CreateGroupModal.tsx` - Modal for creating group chats
- `src/components/chat/UserProfileModal.tsx` - Modal for viewing user profile and starting DMs
- `src/components/admin/AdminDashboard.tsx` - Admin dashboard with tabs for Rooms and Users
- `supabase/migrations/00000_initial_schema.sql` - Complete database schema with all functions
- `plans/chat-room-improvements.md` - Detailed implementation plan for Session 1.9
- `plans/fix-sidebar-realtime-updates.md` - Implementation plan for fixing sidebar realtime updates

## 9. System Messages Events
- User joins room: "{username} joined the chat"
- User leaves room: "{username} left the chat"
- User is removed: "{username} was removed by {remover}"
- User is promoted to admin: "{username} is now an admin"
- User is demoted from admin: "{username} is no longer an admin"
- Room name changed: "Room name changed to '{name}' by {username}"

## 10. Files Created/Modified in Session 1.9

### New Files Created
- `src/components/chat/RoomSidebar.tsx` - Room list sidebar with personal/group sections
- `src/components/chat/CreateGroupModal.tsx` - Group creation modal with member selection
- `src/components/chat/UserProfileModal.tsx` - User profile modal for starting DMs
- `plans/chat-room-improvements.md` - Implementation plan document

### Modified Files
- `supabase/migrations/00000_initial_schema.sql` - Added all chat room improvement functions
- `src/types/database.ts` - Added RoomWithMeta, RoomMemberWithUsername types
- `src/lib/chatService.ts` - Added getUserRooms, getOrCreatePersonalChat, createGroupChat, leaveRoom, getRoomDisplayName, getRoomById, sendSystemMessage, subscribeToUserRooms
- `src/lib/adminService.ts` - Added permission methods (canManageMembers, canManageAdmins, canChangeRoomName), room admin management (addRoomAdmin, removeRoomAdmin, updateRoomName), member management (addMemberToRoom, removeMemberFromRoom), getRoomMembers, getAvailableUsersForRoom, getAllUsersForSearch
- `src/components/Dashboard.tsx` - Restructured with RoomSidebar, added room selection handling, room display name, member change callbacks
- `src/components/chat/MembersList.tsx` - Added member management UI (promote/demote/remove), leave room functionality, add member modal

## 11. Files Created/Modified in Session 1.10

### New Files Created
- `plans/fix-sidebar-realtime-updates.md` - Implementation plan for fixing sidebar realtime updates

### Modified Files
- `src/lib/chatService.ts` - Added subscribeToMessagesForRooms function for real-time message subscription
- `src/components/chat/RoomSidebar.tsx` - Added useEffect to subscribe to messages for all user rooms

## 12. Files Created/Modified in Session 1.11

### New Files Created
- `src/config/uiStrings.ts` - Centralized manifest for all UI text strings

### Modified Files
- `supabase/migrations/00000_initial_schema.sql` - Added `clear_room_messages` function
- `src/types/database.ts` - Updated `RoomWithMeta` with last message fields
- `src/lib/chatService.ts` - Updated `clearChat` to use the new RPC
- `src/lib/adminService.ts` - Updated `deleteAllMessages` to use the new RPC
- `src/components/chat/ChatBox.tsx` - Updated empty state UI and integration with UI manifest
- `src/components/chat/RoomSidebar.tsx` - Updated to display message previews and fix activity time indicators
- `src/components/admin/AdminDashboard.tsx` - Refactored to use UI manifest labels
- `src/components/admin/RoomManager.tsx` - Refactored to use UI manifest labels

## 13. Files Created/Modified in Session 1.12 (Unread System & User Search)

### New Files Created
- (none)

### Modified Files
- `src/app/layout.tsx` - Updated metadata title to "Digital Tambayan" and added React import
- `src/components/Dashboard.tsx` - Added unread message tracking with localStorage, added `handleSendMessage` wrapper, added `handleRoomSelectWithRead` function
- `src/components/chat/RoomSidebar.tsx` - Added unread message indicators (blue dot), user search functionality to start direct messages, `isRoomUnread` function, `handleRoomClick` function, filtered users logic
- `src/config/uiStrings.ts` - Added UI strings for "users" and "startConversation"
- `src/hooks/useTypingIndicator.ts` - Added cleanup of typing users when room changes

### Known Issues
- **Unread System Broken**: The unread message tracking logic has issues - it compares timestamps incorrectly and the system needs debugging to properly highlight unread rooms.

## 14. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Dashboard.tsx                         │
├────────────────┬─────────────────────────────┬───────────────┤
│  RoomSidebar   │         Chat Area           │  MembersList  │
│                │                             │  (toggleable) │
│  - Personal    │  ┌───────────────────────┐  │               │
│    Chats       │  │   ChatBox             │  │  - Members    │
│  - Group       │  │   (messages)          │  │  - Promote    │
│    Chats       │  └───────────────────────┘  │  - Demote     │
│  - Create      │  ┌───────────────────────┐  │  - Remove     │
│    Group       │  │   ChatInput           │  │  - Leave      │
│                │  └───────────────────────┘  │  - Add Member │
└────────────────┴─────────────────────────────┴───────────────┘
```

## 15. Service Layer API Reference

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
| `getRoomDisplayName(roomId, currentUserId)` | Get display name for room |
| `getRoomById(roomId)` | Get room by ID |
| `sendSystemMessage(roomId, content)` | Send system message |
| `subscribeToMessages(roomId, onInsert, onDelete)` | Real-time subscription |
| `subscribeToUserRooms(userId, onRoomChange)` | Room list changes |
| `subscribeToMessagesForRooms(roomIds, onMessage)` | Subscribe to messages for all rooms |
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
