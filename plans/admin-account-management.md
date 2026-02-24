# Plan: Admin Account Management System

## Overview
Add a modular Admin Dashboard system with the following features:
- Restructure Settings modal to have navigation tabs
- Admin-only dashboard with room management, message management, and user management
- Well-designed modular code structure for future extensibility

---

## Todo List

### Phase 1: Database & Service Layer
- [ ] **1.1** Create admin service layer (`src/lib/adminService.ts`) with functions for:
  - `getAllRooms()` - Fetch all chat rooms
  - `createRoom(slug, name)` - Create new room
  - `deleteAllMessages(roomId)` - Delete all messages in a room
  - `getAllUsers()` - Fetch all user profiles
  - `deleteUser(userId)` - Delete both profile and auth account

- [ ] **1.2** Review/update RLS policies in Supabase to allow admin operations

### Phase 2: Dashboard Component Refactoring
- [ ] **2.1** Remove existing "Clear History" button from chat header (lines 114-124 in Dashboard.tsx)
- [ ] **2.2** Create Settings navigation structure with tabs:
  - Tab 1: Admin Dashboard (only visible when `profile.is_admin === true`)
  - Tab 2: Change Password (current security settings)

### Phase 3: Admin Dashboard Implementation
- [ ] **3.1** Create modular AdminDashboard component (`src/components/admin/AdminDashboard.tsx`)
- [ ] **3.2** Implement Room Management section:
  - Display list of all rooms
  - Add new room form (slug + name inputs)
  - Delete messages button for each room
- [ ] **3.3** Implement User Management section:
  - Display list of all users (username, email, is_admin status)
  - Delete user button (deletes profile + auth account)
- [ ] **3.4** Design with extensibility in mind (component-based architecture for future admin features)

### Phase 4: Integration & Testing
- [ ] **4.1** Wire up admin service in Dashboard.tsx
- [ ] **4.2** Test admin functionality with test admin account
- [ ] **4.3** Verify non-admin users cannot access admin features

---

## Architecture Notes

### Modular Admin Dashboard Design
The Admin Dashboard will be structured for easy future expansion:

```
src/components/admin/
├── AdminDashboard.tsx      # Main container with tab navigation
├── RoomManager.tsx         # Room CRUD operations
├── UserManager.tsx         # User management operations
└── index.ts                # Barrel export
```

### Each admin feature component will follow this pattern:
- Self-contained component with own state
- Clear props interface for data input
- Error handling and loading states
- Extensible props for future customization

---

## Database Changes
No new tables needed. Admin operations will use existing tables:
- `profiles` - User data
- `rooms` - Chat rooms
- `messages` - Chat messages
- `auth.users` - Supabase auth (for user deletion)

---

## Security Considerations
- All admin operations check `profile.is_admin` on client side
- RLS policies should enforce admin-only operations on server side
- Delete user operation requires careful handling to maintain referential integrity
