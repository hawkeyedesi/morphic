# Implementing Advanced File Processing

This guide will help you set up and use the advanced file processing feature with unstructured.io and Qdrant for semantic document search.

## Prerequisites

1. Docker and Docker Compose installed on your system
2. Node.js/Bun installed for running the application
3. The Morphic application code

## Setup Instructions

### 1. Start Required Services

We've created a helper script to start the necessary services. Run:

```bash
./start-advanced-processing.sh
```

This script will:
- Start Redis for metadata storage
- Start Qdrant for vector storage
- Configure fallback processing for Apple Silicon Macs
- Start unstructured.io (if on x86_64 architecture)
- Update your .env.local file with the necessary settings

### 2. Configuration Options

The following configuration options are available in your `.env.local` file:

```
# Enable advanced file processing
USE_ADVANCED_FILE_PROCESSING=true

# For Apple Silicon (ARM64) Macs
SKIP_UNSTRUCTURED=true  # Skip using unstructured.io and use fallback processing
# USE_UNSTRUCTURED_CLOUD_API=true  # Uncomment to use cloud API instead of local

# Qdrant Vector Database Configuration
QDRANT_URL=http://localhost:6333
```

### 3. Test the Implementation

1. Start your application:
   ```bash
   bun dev
   ```

2. Open the application in your browser (usually at http://localhost:3000)

3. Upload a document file (PDF, DOCX, etc.) in a chat session

4. The document will be processed using:
   - unstructured.io for advanced document chunking (or fallback processing on ARM64)
   - OpenAI embeddings for vectorization
   - Qdrant for vector storage and semantic search

5. Ask questions related to the document content to test semantic search

## How It Works

1. **Document Processing**:
   - Files are uploaded and stored
   - Text is extracted using unstructured.io or fallback methods
   - Documents are split into semantic chunks

2. **Vector Storage**:
   - Text chunks are converted to embeddings
   - Embeddings are stored in Qdrant
   - Metadata is preserved for retrieval

3. **Semantic Search**:
   - User queries are converted to embeddings
   - Similar document chunks are retrieved from Qdrant
   - Relevant context is provided to the AI for answers

## Fallback Mechanisms

The implementation includes several fallback mechanisms for reliability:

1. If Qdrant is unavailable, the system will fall back to basic text storage
2. If unstructured.io is unavailable (or on ARM64), a simpler chunking approach is used
3. PDF processing uses multiple methods to ensure text extraction

## Troubleshooting

### Common Issues:

1. **Docker services not starting**:
   Check Docker logs with `docker compose logs redis qdrant`

2. **Processing fails for large files**:
   Adjust chunk size and batch processing parameters in the code

3. **Embeddings generation fails**:
   Verify your OpenAI API key is configured correctly

4. **Text extraction issues with certain file formats**:
   Try converting the file to a different format, or check if the file is properly formatted

## Next Steps

To further enhance the implementation, consider:

1. Adding support for more file formats
2. Implementing custom chunking strategies for different document types
3. Adding a web UI for monitoring document processing status
4. Supporting multi-user isolation for document vectors