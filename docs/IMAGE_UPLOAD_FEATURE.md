# Image Upload Feature Documentation

## Overview
The document service now supports image uploads (PNG, JPG, JPEG) with automatic analysis using Ollama's Llama 3.2 Vision model. When an image is uploaded, the system:

1. Generates a detailed description of the image
2. Extracts any text found in the image (OCR)
3. Creates searchable chunks from both the description and extracted text
4. Stores the image file and its analysis results

## Prerequisites

### 1. Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Start Ollama Service
```bash
ollama serve
```

### 3. Pull the Llama 3.2 Vision Model
```bash
ollama pull llama3.2-vision
```

### 4. Verify Installation
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Verify llama3.2-vision is available
ollama list
```

## Usage

### Uploading Images
1. Navigate to the document upload interface
2. Drag and drop or select image files (PNG, JPG, JPEG)
3. The system will automatically:
   - Upload the image
   - Analyze it with Llama 3.2 Vision
   - Extract text and generate descriptions
   - Create searchable chunks

### Searching Image Content
- Image descriptions and extracted text are fully searchable
- Use natural language queries to find images based on their content
- Search results will include relevant image chunks alongside text documents

## Technical Implementation

### Key Files Modified
1. **`/lib/services/ollama-vision.ts`** - New service for Ollama Vision API integration
2. **`/lib/services/simple-document-service.ts`** - Updated to handle image parsing
3. **`/components/document-upload.tsx`** - Updated UI to accept image files
4. **`/app/api/documents/route.ts`** - Updated API to validate image file types

### Image Processing Flow
1. Image buffer is converted to base64
2. Two prompts are sent to Llama 3.2 Vision:
   - Description prompt for detailed image analysis
   - OCR prompt for text extraction
3. Results are combined into searchable content
4. Content is chunked and embedded for semantic search

## Error Handling
- If Ollama is not running or the model is not available, a clear error message is displayed
- Image analysis failures are logged but don't prevent file upload
- Fallback to basic file storage if vision analysis fails

## Limitations
- Maximum file size: 10MB
- Supported formats: PNG, JPG, JPEG
- Requires local Ollama installation
- Processing time depends on image complexity and local hardware

## Troubleshooting

### Ollama Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
killall ollama
ollama serve
```

### Model Not Found
```bash
# Re-pull the model
ollama pull llama3.2-vision

# List available models
ollama list
```

### Performance Issues
- Ensure sufficient RAM (8GB+ recommended)
- Close other applications during image processing
- Consider using smaller images for faster processing