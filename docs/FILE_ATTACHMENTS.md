# File Attachments Feature

## Overview

The file attachments feature allows users to upload files to their chats and have the AI use the content of these files as additional context when answering questions. This enhances the AI's ability to provide relevant answers and allows users to reference specific documents in their conversations.

## Components

### API Endpoints

- **Upload Files**: `POST /api/attachments/upload`
  - Uploads one or more files and associates them with a chat
  - Processes files to extract text content when possible
  
- **Process Files**: `POST /api/attachments/process`
  - Processes a file to extract its text content
  - Updates the file's metadata with the extracted text
  
- **Get File**: `GET /api/attachments/[id]`
  - Retrieves a file's metadata or content
  - Supports downloading the file
  
- **Delete File**: `DELETE /api/attachments/[id]`
  - Removes a file from storage and its metadata from the database
  
- **List Files**: `GET /api/attachments/list?chatId=[chatId]`
  - Lists all files attached to a specific chat

### UI Components

- **FileUpload**: Allows users to select and upload files
- **FileAttachment**: Displays an individual file with actions (preview, download, delete)
- **FileAttachmentsSection**: Container for file attachments and upload functionality

### Utilities

- **file-utils.ts**: Core file operations (storage, validation)
- **file-processor.ts**: File content extraction (PDF, DOCX, text files)
- **attachment-utils.ts**: Functions to retrieve and process file attachments for AI context

## Supported File Types

- PDF documents (application/pdf)
- Plain text (text/plain)
- Markdown (text/markdown)
- HTML (text/html)
- CSS (text/css)
- JavaScript (text/javascript)
- JSON (application/json)
- XML (application/xml)
- Images (image/jpeg, image/png, image/gif, image/webp)
- Microsoft Office (DOCX, XLSX, PPTX)

## How It Works

1. **File Upload**:
   - User uploads files through the UI
   - Files are stored on the server's filesystem
   - File metadata is stored in Redis
   - Each file is associated with a specific chat ID

2. **Text Extraction**:
   - For supported file types, text is extracted automatically
   - PDFs are processed using pdf-parse
   - DOCX files are processed using mammoth
   - Text files are read directly
   - Images currently only store their file name (future: OCR)

3. **Integration with Chat**:
   - When a user sends a message with files attached, the file IDs are included
   - The system retrieves the files' content and adds it as context
   - The AI uses this context to provide more relevant answers
   - File attachments are displayed in the chat UI for reference

4. **File Management**:
   - Users can view, download, and delete their attached files
   - Files can be previewed directly in the UI when text content is available

## Usage

### In Chat Components

```tsx
// Example: Using file attachments in a chat
<Chat
  id={chatId}
  // Other props...
/>
```

The Chat component handles file attachments internally, allowing users to:
- Upload files via the paperclip icon in the chat interface
- View attached files in a list below the input area
- Preview file content directly in the UI
- Download original files
- Remove attachments when needed

### API Usage

```typescript
// Example: Processing attached files for AI context
async function processChat(messages, chatId) {
  // Get processed messages with file context
  const processedMessages = await processFileAttachments(messages, chatId);
  
  // Use the processed messages for AI completion
  const response = await getAIResponse(processedMessages);
  
  return response;
}
```

## Data Model

### FileAttachment

```typescript
interface FileAttachment {
  id: string;                  // Unique identifier
  originalName: string;        // Original filename
  storagePath: string;         // Path on server
  mimeType: string;            // MIME type
  size: number;                // Size in bytes
  uploadedAt: Date;            // Upload timestamp
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: string;      // Extracted text content
  error?: string;              // Error message if processing failed
}
```

### DocumentChunk

```typescript
interface DocumentChunk {
  id: string;                  // Unique chunk identifier
  content: string;             // Text content
  metadata: {
    documentId: string;        // Reference to parent document
    position: number;          // Position in document
  };
}
```

## Storage

- **File Storage**: Files are stored on the server's filesystem in a designated uploads directory
- **Metadata Storage**: File metadata is stored in Redis with the following keys:
  - `file:{fileId}`: Hash containing file metadata
  - `chat:{chatId}:files`: Set containing file IDs associated with a chat

## Future Improvements

1. **OCR for Images**: Add optical character recognition for images
2. **Vector Database Integration**: Store file chunks in a vector database for semantic search
3. **Larger File Support**: Add chunking and streaming for very large files
4. **Cloud Storage**: Integrate with cloud storage providers (S3, Azure Blob, etc.)
5. **Collaborative Attachments**: Allow shared access to attachments in collaborative chats
6. **Version History**: Track changes to documents over time
7. **Fine-tuning with Attachments**: Use attached documents for model fine-tuning