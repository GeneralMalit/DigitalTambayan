# Fix Berto AI Implementation and Add Dev Button

## Problem Analysis
1. When @Berto is mentioned in chat, there's an error in console: "Berto AI is unimplemented or error occurred: {}"
2. Berto's placeholder responses are not visible in the chat window
3. Need to add a dev button that sends test is_system messages

## Key Files to Modify
1. `src/lib/chatService.ts` - Fix Berto AI implementation
2. `src/components/chat/ChatBox.tsx` - Add dev button
3. `src/hooks/useChat.ts` - Ensure real-time messages are properly updated
4. `src/components/chat/MessageItem.tsx` - Verify system message rendering

## Implementation Steps

### 1. Fix Berto AI Implementation (src/lib/chatService.ts)
- Check if the database insert is failing in `triggerBotResponse`
- Verify is_system flag is properly set
- Add error logging with more details

### 2. Add Dev Button Component (src/components/chat/ChatBox.tsx)
- Add a button beside the chat window
- Handle click event to send test system message
- Button should only be visible in development environment

### 3. Ensure Real-time Updates Work (src/hooks/useChat.ts)
- Verify that Berto's messages are properly received and added to the UI
- Check the subscription to messages channel

### 4. Verify System Message Rendering (src/components/chat/MessageItem.tsx)
- Check if MessageItem properly handles system messages
- Ensure they're styled appropriately

## Expected Outcome
- @Berto mentions should display placeholder responses in chat
- Dev button should send test system messages
- Console error should be resolved
