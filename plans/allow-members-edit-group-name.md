# Allow Group Chat Members to Edit Group Name

## Overview
This plan outlines the implementation to allow all group chat members (not just admins) to edit the group name.

## Current State Analysis

### Backend ✅ Already Supports This
The database and service layers are already configured to allow any room member to change the room name:

1. **Database Function** [`update_room_name`](../supabase/migrations/00000_initial_schema.sql:466):
   - Only checks if user is a room member
   - Does NOT require admin role
   ```sql
   SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = p_room_id AND user_id = p_requester_id) INTO v_is_member;
   IF NOT v_is_member THEN RETURN 'not_authorized'; END IF;
   ```

2. **Service Layer** [`adminService.canChangeRoomName()`](../src/lib/adminService.ts:379):
   - Returns `true` for any room member
   ```typescript
   async canChangeRoomName(roomId: string, userId: string): Promise<boolean> {
       return this.isRoomMember(roomId, userId)
   }
   ```

3. **Service Layer** [`adminService.updateRoomName()`](../src/lib/adminService.ts:423):
   - Already implemented and working

### UI Layer ❌ Missing
There is currently no UI for editing the group name. The room name is displayed in:
- [`Dashboard.tsx`](../src/components/Dashboard.tsx:254) - Chat header (read-only)
- [`MembersList.tsx`](../src/components/chat/MembersList.tsx) - No room name editing UI

## Implementation Plan

### 1. Add Edit Group Name UI in MembersList Component

Add an editable room name section at the top of the MembersList panel:

```
┌─────────────────────┐
│ Members         [X] │
├─────────────────────┤
│ Group Name          │
│ ┌─────────────────┐ │
│ │ Barkada    [✏️] │ │
│ └─────────────────┘ │
├─────────────────────┤
│ 👤 Juan (admin)     │
│ 👤 Maria            │
│ 👤 Pedro            │
├─────────────────────┤
│ [+ Add Member]      │
│ [Leave Room]        │
└─────────────────────┘
```

**Changes to [`MembersList.tsx`](../src/components/chat/MembersList.tsx):**
- Add state for editing mode and new name
- Add room name display with edit button (pencil icon)
- Add inline text input when editing
- Add save/cancel buttons during edit
- Call `adminService.updateRoomName()` on save
- Send system message when name changes
- Callback to parent to refresh room display name

### 2. Add System Message on Name Change

When the room name is changed, send a system message:
```
"Room name changed to 'New Name' by Juan"
```

**Implementation:**
- Use existing [`chatService.sendSystemMessage()`](../src/lib/chatService.ts:342)
- Include the new name and the user who made the change

### 3. Update Dashboard After Name Change

**Changes to [`Dashboard.tsx`](../src/components/Dashboard.tsx):**
- Add callback prop to MembersList for room name changes
- Refresh `roomDisplayName` state when name is changed

### 4. Permission Considerations

According to the permission matrix in the original plan:

| Action | Personal Chat | Group Chat Member | Group Chat Admin |
|--------|---------------|-------------------|------------------|
| Change Room Name | ✅ (both) | ✅ | ✅ |

- **Group chats**: All members can edit
- **Personal chats**: Both participants can edit (though the name is derived from the other user's name, so editing may not be applicable)

## Files to Modify

| File | Changes |
|------|---------|
| [`src/components/chat/MembersList.tsx`](../src/components/chat/MembersList.tsx) | Add room name editing UI |
| [`src/components/Dashboard.tsx`](../src/components/Dashboard.tsx) | Add callback for room name refresh |

## UI Design Details

### Room Name Section in MembersList

```tsx
{/* Room Name Section - Only for group chats */}
{!isPersonalChat && (
    <div className="px-4 py-3 border-b border-white/10">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">
            Group Name
        </label>
        {isEditingName ? (
            <div className="flex items-center gap-2 mt-1">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm"
                    placeholder="Enter group name"
                />
                <button onClick={handleSaveName} className="p-1.5 text-green-500">
                    <CheckIcon />
                </button>
                <button onClick={handleCancelEdit} className="p-1.5 text-red-500">
                    <XIcon />
                </button>
            </div>
        ) : (
            <div className="flex items-center justify-between mt-1">
                <span className="text-white font-medium">
                    {room?.name || 'Unnamed Group'}
                </span>
                <button 
                    onClick={() => setIsEditingName(true)}
                    className="p-1.5 text-zinc-400 hover:text-white"
                >
                    <PencilIcon />
                </button>
            </div>
        )}
    </div>
)}
```

## Implementation Steps

1. **MembersList.tsx** - Add room name editing UI:
   - Add `isEditingName` and `newName` state
   - Add room name section above members list
   - Add edit/save/cancel handlers
   - Call `adminService.updateRoomName()`
   - Send system message on success
   - Call `onRoomNameChange` callback

2. **Dashboard.tsx** - Handle room name changes:
   - Add `onRoomNameChange` prop to MembersList
   - Refresh room display name when changed

## Testing Checklist

- [ ] Group chat member can see edit button for group name
- [ ] Clicking edit shows inline text input
- [ ] Saving updates the room name in database
- [ ] System message appears in chat after name change
- [ ] Room name updates in Dashboard header
- [ ] Room name updates in RoomSidebar
- [ ] Cancel button reverts to original name
- [ ] Personal chats do not show name editing UI
