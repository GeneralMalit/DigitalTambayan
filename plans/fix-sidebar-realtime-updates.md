# Fix: Sidebar Last Message Not Updating in Real-Time

## Problem Statement

The chat room sidebar displays the last message indicator and timestamp for each room. However, these details don't update when:
- A new message is sent by the current user
- A new message arrives from another user

The sidebar only refreshes when the page is manually refreshed.

## Root Cause Analysis

After analyzing the codebase, I identified the following:

### Current Architecture

1. **[`RoomSidebar.tsx`](src/components/chat/RoomSidebar.tsx)**: 
   - Loads rooms via [`chatService.getUserRooms()`](src/lib/chatService.ts:224) which calls the RPC function `get_user_rooms`
   - The `RoomWithMeta` type includes `last_message_at`, `last_message_content`, and `last_message_sender` fields

2. **[`chatService.subscribeToUserRooms()`](src/lib/chatService.ts:366)**:
   - Currently subscribes to changes in the `room_members` table only
   - Triggers `onRoomChange()` callback when room membership changes
   - **Does NOT** listen for changes in the `messages` table

3. **The Gap**:
   - When a new message is added to a room, it only modifies the `messages` table
   - The `room_members` table is not affected by new messages
   - Therefore, the real-time subscription doesn't trigger a sidebar refresh when messages are sent/received

### Data Flow

```
User sends message → messages table INSERT → 
  → subscribeToMessages (in useChat) updates chat view ✓
  → subscribeToUserRooms does NOT trigger (wrong table) ✗
  → RoomSidebar doesn't refresh ✗
```

## Solution

Add a real-time subscription to the `messages` table in the `RoomSidebar` component that will refresh the room list when any message is added to any room the user belongs to.

### Implementation Steps

1. **Modify `chatService.ts`**:
   - Add a new function `subscribeToMessagesForUserRooms()` that:
     - Takes `userId` and a callback function
     - Subscribes to INSERT events on the `messages` table
     - Filters to only rooms where the user is a member
     - Triggers the callback when new messages arrive

2. **Update `RoomSidebar.tsx`**:
   - Add the new message subscription alongside the existing room_members subscription
   - When a new message is detected, call `loadRooms()` to refresh the sidebar with updated last message info

### Alternative Approaches Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Add messages subscription (recommended)** | Works with existing RPC, minimal changes | Requires filtering on client |
| Store last_message fields in room_members | Faster queries | Data duplication, sync complexity |
| Use database triggers to update rooms table | True real-time | Requires DB migration |

## Files to Modify

- [`src/lib/chatService.ts`](src/lib/chatService.ts) - Add new subscription function
- [`src/components/chat/RoomSidebar.tsx`](src/components/chat/RoomSidebar.tsx) - Add message subscription

## Testing Checklist

- [ ] Send a message → Sidebar updates with new timestamp and preview
- [ ] Receive a message → Sidebar updates with new timestamp and preview
- [ ] Switch rooms → Sidebar reflects correct last message for each room
- [ ] Page refresh → All last messages display correctly
