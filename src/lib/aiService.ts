import { BOT_CONFIG } from '@/config/botManifest'

/**
 * Service for interacting with the Gemini API
 */
export const aiService = {
    /**
     * Generates a response from the AI model based on the provided context.
     * @param formattedContext The chat history formatted as a string.
     * @returns The generated text response.
     */
    async generateResponse(formattedContext: string): Promise<string> {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY

        if (!apiKey) {
            console.error('Gemini API key is missing. Please set NEXT_PUBLIC_GEMINI_API_KEY.')
            throw new Error('API key missing')
        }

        const prompt = `${BOT_CONFIG.systemPrompt}\n\nHere is the recent conversation history:\n\n${formattedContext}\n\n${BOT_CONFIG.name}:`

        try {
            const requestBody = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 250,
                }
            }

            if (BOT_CONFIG.logApiRequests) {
                console.log('Gemini API Request Body:', JSON.stringify(requestBody, null, 2))
            }

            // Using the configured modelName via Google AI Studio API
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${BOT_CONFIG.modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('Gemini API Error:', errorData)
                throw new Error(`API returned ${response.status}`)
            }

            const data = await response.json()

            if (BOT_CONFIG.logApiResponses) {
                console.log('Gemini API Response Data:', JSON.stringify(data, null, 2))
            }

            // Extract the generated text from the response format
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

            if (!generatedText) {
                console.error('Gemini API returned no text. Candidates:', data.candidates)
                // Check if it was blocked by safety filters
                const blockReason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason
                if (blockReason) {
                    throw new Error(`AI blocked response: ${blockReason}`)
                }
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
