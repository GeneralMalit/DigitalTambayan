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
    created_at: string;
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
        };
    };
};
