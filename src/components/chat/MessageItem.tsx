import { Message } from '@/types/database'

interface MessageItemProps {
    message: Message
    isOwn: boolean
}

export default function MessageItem({ message, isOwn }: MessageItemProps) {
    const isBot = message.is_bot

    return (
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex items-baseline space-x-2 mb-1 px-1`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isBot ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {message.sender_name} {isBot && '🤖'}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <div className={`
                max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-lg backdrop-blur-md
                ${isBot
                    ? 'bg-blue-600/10 border border-blue-500/20 text-blue-100 italic'
                    : isOwn
                        ? 'bg-blue-600 border border-blue-500 text-white rounded-tr-none'
                        : 'bg-white/5 border border-white/10 text-zinc-200 rounded-tl-none'}
            `}>
                {message.content}
            </div>
        </div>
    )
}
