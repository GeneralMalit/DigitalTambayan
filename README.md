# Digital Tambayan
Digital Tambayan is a real-time chat app built around the idea of a friendly community "tambayan": fast DMs, flexible group chats, private nicknames, photos, and a nickname-aware AI companion (Berto).

## Stack - React 19 + TypeScript

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-087EA4?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-API-4285F4?style=for-the-badge&logo=google&logoColor=white)

## Key Features

- Real-time messaging with Supabase Realtime
- Personal chats (DMs) auto-created from user search
- Group chats with roles: owner, admin, member
- Private per-user nicknames (room-scoped and not shared)
- Profile and group photos (crop + upload + realtime sync)
- Berto AI bot (Gemini) using recent context and the triggering user's nickname perspective
- Admin dashboard: manage rooms, users, and global chat settings

## Security Model (RLS + Server Routes)

Digital Tambayan uses a hybrid approach:

- Row Level Security enforces membership-scoped access to `rooms`, `room_members`, and `messages`
- `profiles` stores only public-ish fields (no public email column)
- Username login uses a server route that resolves `username -> email` from a private mapping table
- Sensitive operations run server-side using a Supabase service role key

Important notes:

- `private.user_login_emails` stores the username/email mapping and is not readable from the browser
- Admin-only endpoints require `profiles.is_admin = true` (still manually toggleable for tester accounts)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server-only (do not expose to the browser)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key

# Backward-compatible fallback (not recommended)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### Install + Run

```bash
npm install
npm run dev
```

## Database

Core tables (public):

- `profiles`: `id`, `username`, `avatar_url`, `is_admin`, `updated_at`
- `rooms`: group chats + DMs (with `is_personal`)
- `room_members`: membership and role per room
- `messages`: room-scoped chat messages
- `chat_settings`: global deletion settings
- `room_member_nicknames`: per-user nicknames scoped to room + setter

Private tables (private schema):

- `private.user_login_emails`: username/email mapping for server-side username sign-in

Migrations of interest:

- `supabase/migrations/20260304_security_hardening.sql`
- `supabase/migrations/20260304_security_hardening_followup.sql`

## Versioning

Single source of truth is `package.json#version`.

- Update version manually in `package.json`
- UI version display is rendered from the same source via `src/lib/appMeta.ts` and shown in the global layout footer

## Repo Structure (high level)

- `src/lib/*`: app services (auth/chat/admin/storage/ai)
- `src/hooks/*`: stateful realtime hooks
- `src/components/*`: UI (chat/admin/auth)
- `src/app/api/*`: server routes (username sign-in, AI proxy, admin-only user deletion)
- `supabase/migrations/*`: schema, RPCs, and RLS

## Troubleshooting

- `Missing Supabase admin environment variables`: set `SUPABASE_SERVICE_ROLE_KEY` and restart `next dev`
- Username sign-in failing: verify `private.user_login_emails` has the correct row (backfilled by migration)
- `500` on room reads: indicates RLS/policy issues; ensure the follow-up migration was applied

## License

MIT
