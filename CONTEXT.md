# PROJECT: Digital Tambyan (Master Context)

## 0. Current Session Status
- **Current Goal:** MVP Completed! Digital Tambayan is live.
- **Last Completed Prompt:** Session 1.7: Berto Bot Stub Implementation - COMPLETE

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
- `src/hooks`: All stateful/socket logic.
- `src/lib`: Database/External API services.
- `src/utils/supabase`: Client/Server Supabase factories.

## 4. Current Database Schema
- `profiles`: `id` (PK), `username` (unique), `email` (unique), `is_admin`, `updated_at`
- `rooms`: `id` (PK), `slug` (unique), `name`, `created_at`
- `messages`: `id` (PK), `room_id` (FK), `user_id` (FK, nullable), `sender_name`, `content`, `is_bot`, `is_system`, `created_at`

## 5. Development Log (Progress Tracker)
- [x] Session 1.1: Project Init & Manifest.
- [x] Session 1.2: Email/Password Auth & Profile Linkage.
- [x] Session 1.2.5: Auth Bug Fixes & User Settings.
- [x] Session 1.3: Persistent Chat Storage.
- [x] Session 1.4: Real-time Chat Messaging Engine.
- [x] Session 1.5: Chat UI, Hooks & Admin 'Clear History'.
- [x] Session 1.6: Typing Indicator & System Messages.
- [x] Session 1.7: Berto Bot Stub Implementation.

## 6. Active Constraints
- Auth: Custom Sign-up/Login forms required.
- Admin: Manually toggle `is_admin` in Supabase dashboard for the tester account.
- Berto Bot: Currently a STUB - returns placeholder responses when @Berto is mentioned. Ready for future AI integration.

## 7. Key Files Reference
- `src/config/botManifest.ts` - Bot configuration (Berto name, trigger, placeholder responses)
- `src/hooks/useChat.ts` - Chat state management with real-time subscriptions
- `src/hooks/useTypingIndicator.ts` - Typing indicator broadcast logic
- `src/lib/chatService.ts` - Message CRUD, real-time subscriptions, Berto bot stub
- `src/components/Dashboard.tsx` - Main dashboard with chat, settings modal, admin controls