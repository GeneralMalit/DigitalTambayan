import { supabase } from '@/utils/supabase/client'

export const storageService = {
    /**
     * Resizes an image to exactly 200x200 pixels using a canvas.
     * @param file - The original file
     * @returns A promise resolving to a Blob
     */
    async resizeImage(file: File): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 200;
                    canvas.height = 200;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Draw image centered and cropped to fit the 200x200 square
                    const scale = Math.max(200 / img.width, 200 / img.height);
                    const x = (200 - img.width * scale) / 2;
                    const y = (200 - img.height * scale) / 2;
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas conversion failed'));
                    }, 'image/jpeg', 0.8);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
        });
    },

    /**
     * Uploads a profile photo for a user.
     * @param userId - The user's ID
     * @param blob - The resized image blob
     */
    async uploadProfilePhoto(userId: string, blob: Blob): Promise<string> {
        const filePath = `profiles/${userId}/${Date.now()}.jpg`;

        // Delete old files in that folder first to avoid storage bloat (optional, but good practice)
        try {
            const { data: list } = await supabase.storage.from('avatars').list(`profiles/${userId}`);
            if (list && list.length > 0) {
                await supabase.storage.from('avatars').remove(list.map((f: any) => `profiles/${userId}/${f.name}`));
            }
        } catch (e) {
            console.warn('Error cleaning up old profile photos:', e);
        }

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update profile in DB
        const { error: dbError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (dbError) throw dbError;

        return publicUrl;
    },

    /**
     * Uploads a photo for a room (group chat).
     * @param roomId - The room ID
     * @param blob - The resized image blob
     * @param userId - The user ID making the upload
     */
    async uploadGroupPhoto(roomId: string, blob: Blob): Promise<string> {
        const filePath = `rooms/${roomId}/${Date.now()}.jpg`;

        // Clean up old photos
        try {
            const { data: list } = await supabase.storage.from('avatars').list(`rooms/${roomId}`);
            if (list && list.length > 0) {
                await supabase.storage.from('avatars').remove(list.map((f: any) => `rooms/${roomId}/${f.name}`));
            }
        } catch (e) {
            console.warn('Error cleaning up old group photos:', e);
        }

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update room in DB
        const { error: dbError } = await supabase
            .from('rooms')
            .update({ photo_url: publicUrl })
            .eq('id', roomId);

        if (dbError) throw dbError;

        return publicUrl;
    }
};
