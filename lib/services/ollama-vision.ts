import 'server-only'

interface OllamaVisionResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

export async function analyzeImageWithOllama(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ description: string; extractedText: string }> {
  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64')
    
    // Create prompts for both description and OCR
    const descriptionPrompt = 'Provide a detailed description of this image. Include all visible objects, people, text, colors, and any notable features. Be comprehensive and specific.'
    
    const ocrPrompt = 'Extract and list ALL text visible in this image. Include signs, labels, captions, watermarks, and any other readable text. If there is no text, respond with "No text found". Format the extracted text clearly.'
    
    // Get image description
    const descriptionResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: descriptionPrompt,
        images: [base64Image],
        stream: false,
      }),
    })
    
    if (!descriptionResponse.ok) {
      throw new Error(`Ollama description request failed: ${descriptionResponse.status}`)
    }
    
    const descriptionData: OllamaVisionResponse = await descriptionResponse.json()
    
    // Get OCR text
    const ocrResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma3:4b',
        prompt: ocrPrompt,
        images: [base64Image],
        stream: false,
      }),
    })
    
    if (!ocrResponse.ok) {
      throw new Error(`Ollama OCR request failed: ${ocrResponse.status}`)
    }
    
    const ocrData: OllamaVisionResponse = await ocrResponse.json()
    
    return {
      description: descriptionData.response || 'No description generated',
      extractedText: ocrData.response || 'No text found',
    }
  } catch (error) {
    console.error('Ollama Vision API error:', error)
    throw new Error('Failed to analyze image with Ollama Vision')
  }
}

export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    if (!response.ok) return false
    
    const data = await response.json()
    const models = data.models || []
    
    // Check if gemma3:4b is available
    return models.some((model: any) => model.name === 'gemma3:4b')
  } catch (error) {
    console.error('Failed to check Ollama availability:', error)
    return false
  }
}