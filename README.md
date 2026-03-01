# Digital Tambayan 

Digital Tambayan is a modern, real-time chat platform designed for casual and community-focused interactions. Built with a robust technical stack and a focus on visual excellence, it bridges the gap between traditional chat apps and community "tambayans" (hangouts).

---

##  Key Features

###  Real-Time Communication
- **Instant Messaging**: Powered by Supabase Realtime for sub-second latency.
- **Typing Indicators**: Visual feedback when someone is composing a message.
- **System Events**: Automated notifications for room joins, role changes, and name updates.

###  Room Management
- **Personal Chats (DMs)**: Auto-created direct messaging with equal permissions for both users.
- **Group Chats**: Scalable group conversations with a sophisticated role system (Owner, Admin, Member).
- **Role-Based Permissions**: Granular controls for adding/removing members, promoting admins, and room deletion.

###  Identity & Personalization
- **Private Nicknames**: A unique system where users can set private nicknames for others. These nicknames are room-specific and visible only to the user who set them—even the AI bot respects these nicknames!
- **Rich User Profiles**: Customizable profile and group photos with an integrated circular cropping tool.
- **Real-Time Avatars**: Profile updates sync instantly across all active clients.

###  Meet Berto (AI Assistant)
- **Persona-Driven AI**: Berto is an observant friend with a "Taglish Tambay" persona.
- **Context-Aware**: Uses recent chat history and your private nicknames to provide relevant and personalized responses.
- **API Integrated**: Powered by Google's Gemini API.

###  Admin Capabilities
- **Comprehensive Dashboard**: Dedicated tools for website admins to manage rooms, users, and global chat settings.
- **Moderation Tools**: Ability to clear chat histories and manage community growth.

---

##  Technical Stack

- **Core**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Real-Time**: Supabase Realtime (WebSockets)
- **Storage**: Supabase Storage for media assets
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI**: [Google Gemini API](https://ai.google.dev/)
- **Image Processing**: Canvas-based circular cropping and compression

---

##  Modular Architecture

The project follows a clean, service-oriented architecture:

- **Service Layer**: Decoupled business logic (`chatService`, `adminService`, `storageService`, `aiService`).
- **Real-Time Hooks**: Custom React hooks (`useChat`, `useTypingIndicator`) for robust state management.
- **Component System**: Modular UI components organized by feature (Chat, Auth, Admin).
- **Database Logic**: Powered by secure PostgreSQL Functions and Row-Level Security (RLS) policies.

---

##  Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Account

### Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/digital-tambayan.git
   cd digital-tambayan
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Initialize Database**:
   Run the SQL migrations provided in the `supabase/migrations` folder via the Supabase Dashboard SQL Editor.

5. **Run Development Server**:
   ```bash
   npm run dev
   ```

---

##  License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ for the Digital Tambayan community.*
