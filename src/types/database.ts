export type Profile = {
    id: string;
    username: string;
    is_admin: boolean;
    updated_at: string;
};

export type Room = {
    id: string;
    slug: string;
    name: string;
    owner_id: string | null;
    is_personal: boolean;
    display_name: string | null;
    created_at: string;
};

export type RoomWithMeta = {
    id: string;
    slug: string;
    name: string;
    is_personal: boolean;
    display_name: string | null;
    role: string;
    last_message_at: string | null;
    last_message_content: string | null;
    last_message_sender: string | null;
    unread_count: number;
};

export type Message = {
    id: number | string;
    room_id: string;
    user_id: string | null;
    sender_name: string;
    content: string;
    is_bot: boolean;
    is_system: boolean;
    created_at: string;
};

export type ChatSettings = {
    id: string;
    enable_message_deletion: boolean;
    deletion_threshold_minutes: number;
    created_at: string;
    updated_at: string;
};

export type RoomMember = {
    id: string;
    room_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    added_by: string | null;
};

export type RoomMemberWithUsername = {
    user_id: string;
    username: string;
    role: string;
    joined_at: string;
    is_admin: boolean;
};

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Omit<Profile, 'updated_at' | 'is_admin'> & { is_admin?: boolean; updated_at?: string };
                Update: Partial<Profile>;
            };
            rooms: {
                Row: Room;
                Insert: Omit<Room, 'id' | 'created_at'> & { id?: string; created_at?: string };
                Update: Partial<Room>;
            };
            messages: {
                Row: Message;
                Insert: Omit<Message, 'id' | 'created_at'> & { id?: number; created_at?: string };
                Update: Partial<Message>;
            };
            chat_settings: {
                Row: ChatSettings;
                Insert: Omit<ChatSettings, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<ChatSettings>;
            };
            room_members: {
                Row: RoomMember;
                Insert: Omit<RoomMember, 'id' | 'joined_at'> & { id?: string; joined_at?: string };
                Update: Partial<RoomMember>;
            };
        };
    };
};
