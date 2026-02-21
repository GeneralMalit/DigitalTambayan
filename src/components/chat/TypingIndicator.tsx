interface TypingIndicatorProps {
    text: string | null
}

export default function TypingIndicator({ text }: TypingIndicatorProps) {
    if (!text) return null

    return (
        <div className="flex items-center space-x-2 px-4 py-2 text-zinc-500 text-xs italic animate-pulse">
            <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{text}</span>
        </div>
    )
}
