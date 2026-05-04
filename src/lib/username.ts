const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/

export function sanitizeUsername(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24)
}

export function validateUsername(username: string) {
    if (!USERNAME_PATTERN.test(username)) {
        return 'Use 3-24 lowercase letters, numbers, or underscores.'
    }

    if (username.startsWith('pending_')) {
        return 'Choose a username that does not start with pending_.'
    }

    return null
}

export function isPendingUsername(username?: string | null) {
    return Boolean(username?.startsWith('pending_'))
}
