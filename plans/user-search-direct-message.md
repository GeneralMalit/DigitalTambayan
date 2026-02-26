# User Search and Direct Messaging Implementation Plan

## Problem
Users cannot directly search for another user to start a direct message conversation. Currently, the only way to message someone is to create a group chat with them.

## Solution
Integrate user search into the existing sidebar search bar. When users type in the search bar:
1. First show matching Direct Messages and Group Chats (current behavior)
2. Also show matching Users that can be messaged directly

## UI/UX Design

### Search Bar Behavior
- **Default view**: Shows Direct Messages and Group Chats (current behavior)
- **When typing**: Shows both rooms AND users that match the search query
- **Users section**: Shows at the top of search results as "Users" section
- **Clicking a user**: Creates or opens a direct message conversation

### Visual Structure
```
Search: [________________________]

// If search matches users, show:
Users
├─ User 1 (click to message)
├─ User 2 (click to message)

// If search matches rooms, show:
Direct Messages
├─ Chat with User 1
├─ Chat with User 2

Group Chats
├─ Group A
└─ Group B
```

## Implementation Steps

### Step 1: Load Users for Search
In RoomSidebar, load all users (excluding current user) for search:
- Use existing `adminService.getAllUsersForSearch()`
- Cache or load on search focus

### Step 2: Modify Search Logic
Update the search filtering in RoomSidebar to:
1. Keep existing room filtering (personal chats + group chats)
2. Add user filtering - search users by username
3. Show users in a separate "Users" section at top of results

### Step 3: Add User Result Component
Create user result items in the search results:
- Show user avatar and username
- Click handler to create/open direct message

### Step 4: Implement Direct Message Creation
When user is clicked:
- Call `chatService.getOrCreatePersonalChat(currentUserId, userId)`
- This returns existing personal chat OR creates new one
- Navigate to that room

### Step 5: Handle Edge Cases
- Users already in a personal chat should still be searchable
- Don't show users that user already has personal chat with? (optional)
- Handle loading states properly

## Database Function (Already Exists)
The database already has `get_or_create_personal_chat(p_user1_id, p_user2_id)` function that:
1. Checks if a personal chat between two users already exists
2. If exists, returns that room
3. If not, creates a new personal chat room and returns it

## Files to Modify
1. `src/components/chat/RoomSidebar.tsx` - Main search logic and user results
2. `src/config/uiStrings.ts` - Add "Users" section header string
