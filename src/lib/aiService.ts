import { BOT_CONFIG } from '@/config/botManifest'
import { getAuthHeaders } from '@/lib/authHeaders'

/**
 * Service for interacting with the Gemini API
 */
export const aiService = {
    /**
     * Generates a response from the AI model based on the provided context.
     * @param formattedContext The chat history formatted as a string.
     * @returns The generated text response.
     */
    async generateResponse(roomId: string, formattedContext: string): Promise<string> {
        try {
            const response = await fetch('/api/ai/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(await getAuthHeaders())
                },
                body: JSON.stringify({
                    roomId,
                    formattedContext
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('AI route error:', errorData)
                throw new Error(errorData.error || `API returned ${response.status}`)
            }

            const data = await response.json()

            if (BOT_CONFIG.logApiResponses) {
                console.log('Gemini API Response Data:', JSON.stringify(data, null, 2))
            }

            const generatedText = data.text

            if (!generatedText) {
                throw new Error('Unexpected API response format: No text content found')
            }

            return generatedText.trim()
        } catch (error: any) {
            console.error('Failed to generate AI response:', error)
            // Rethrow with more details if it's an object being stringified to {}
            if (error instanceof Error) {
                throw error
            }
            throw new Error(`AI error: ${JSON.stringify(error) || 'Unknown error'}`)
        }
    }
}
