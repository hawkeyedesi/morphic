# Advanced File Processing Integration

This document outlines how to integrate more advanced document processing and vectorized search capabilities into the file attachment feature.

## Planned Integrations

In the planning stage, we discussed integrating the following technologies:

1. **unstructured.io** - For advanced document processing and chunking
2. **Qdrant** - For vector storage and similarity search of document chunks

## Current Implementation vs. Planned Architecture

### Current Implementation

The current implementation uses a simpler approach:

- Files are stored directly on the filesystem (with in-memory fallback)
- Basic text extraction is performed for PDFs and text-based files
- Text content is stored directly in Redis
- The extracted text is provided to the AI as raw context

This approach allows for quick implementation and testing of the file attachment feature without external dependencies.

### Planned Advanced Architecture

The planned architecture would enhance the system with:

1. **Document Processing with unstructured.io**:
   - Extract text with better structure preservation
   - Split documents into semantic chunks
   - Extract metadata, tables, and images
   - Handle a wider variety of document formats

2. **Vector Storage with Qdrant**:
   - Convert text chunks into embeddings
   - Store embeddings in Qdrant vector database
   - Enable semantic similarity search
   - Support relevance filtering and ranking

## Integration Steps

### 1. Integrate unstructured.io

```typescript
// Install dependencies
// npm install unstructured-client

import { UnstructuredClient } from 'unstructured-client';

// Initialize client
const unstructuredClient = new UnstructuredClient({
  apiKey: process.env.UNSTRUCTURED_API_KEY,
  // Or use open source self-hosted version
  baseUrl: process.env.UNSTRUCTURED_API_URL || 'https://api.unstructured.io/general/v0/general'
});

// Process a document
async function processDocumentWithUnstructured(fileBuffer: Buffer, fileName: string) {
  const response = await unstructuredClient.partition({
    files: [{ filename: fileName, data: fileBuffer }],
    strategy: 'auto',
    hiResPdf: true,
    chunking: {
      chunkSize: 1000,
      chunkOverlap: 200
    }
  });

  return response.elements;
}
```

### 2. Integrate Qdrant

```typescript
// Install dependencies
// npm install @qdrant/js-client-rest

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

// Initialize clients
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  openAIApiKey: process.env.OPENAI_API_KEY
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333'
});

// Create a collection if it doesn't exist
async function ensureCollection(collectionName: string) {
  const collections = await qdrant.listCollections();
  
  if (!collections.collections.find(c => c.name === collectionName)) {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: 1536, // Size for text-embedding-3-small
        distance: 'Cosine'
      }
    });
  }
}

// Store document chunks
async function storeDocumentChunks(chunks: any[], fileId: string, chatId: string) {
  const collectionName = 'document_chunks';
  await ensureCollection(collectionName);
  
  // Process chunks in batches
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    // Create embeddings for the batch
    const texts = batch.map(chunk => chunk.text);
    const embeddingResults = await embeddings.embedDocuments(texts);
    
    // Prepare points for Qdrant
    const points = batch.map((chunk, index) => ({
      id: `${fileId}_${chunk.id || index}`,
      vector: embeddingResults[index],
      payload: {
        text: chunk.text,
        metadata: {
          fileId,
          chatId,
          chunkType: chunk.type,
          pageNumber: chunk.metadata?.page_number
        }
      }
    }));
    
    // Upsert points
    await qdrant.upsert(collectionName, {
      points
    });
  }
}

// Search for relevant chunks
async function searchRelevantChunks(query: string, chatId: string, limit: number = 5) {
  const collectionName = 'document_chunks';
  
  // Generate embedding for the query
  const [queryEmbedding] = await embeddings.embedDocuments([query]);
  
  // Search for similar chunks
  const searchResult = await qdrant.search(collectionName, {
    vector: queryEmbedding,
    limit,
    filter: {
      must: [
        {
          key: 'metadata.chatId',
          match: {
            value: chatId
          }
        }
      ]
    }
  });
  
  return searchResult.map(result => ({
    text: result.payload.text,
    score: result.score,
    metadata: result.payload.metadata
  }));
}
```

### 3. Update File Processing Pipeline

```typescript
// Enhanced file processing pipeline
async function processFile(fileAttachment: FileAttachment) {
  // Read file
  const fileBuffer = await readFile(fileAttachment);
  
  // Process with unstructured.io
  const chunks = await processDocumentWithUnstructured(fileBuffer, fileAttachment.originalName);
  
  // Store the chunks in Qdrant
  await storeDocumentChunks(chunks, fileAttachment.id, fileAttachment.chatId);
  
  // Update file metadata
  fileAttachment.processingStatus = 'completed';
  fileAttachment.chunkCount = chunks.length;
  
  // Store a plain text version for direct access
  fileAttachment.extractedText = chunks
    .map(chunk => chunk.text)
    .join('\n\n');
    
  // Update in Redis
  await updateFileMetadata(fileAttachment);
  
  return fileAttachment;
}
```

### 4. Enhanced AI Context Generation

```typescript
// Enhanced context generation for AI
async function generateEnhancedContext(messages: Message[], chatId: string) {
  // Extract user query from last message
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return messages;
  
  const userQuery = lastUserMessage.content as string;
  
  // Search for relevant chunks based on the query
  const relevantChunks = await searchRelevantChunks(userQuery, chatId, 10);
  
  if (relevantChunks.length === 0) return messages;
  
  // Build context from relevant chunks
  const context = `Relevant information from attached documents:
${relevantChunks.map(chunk => 
  `---
${chunk.text}
(Source: ${chunk.metadata.fileId}, Page: ${chunk.metadata.pageNumber || 'N/A'}, Relevance: ${(chunk.score * 100).toFixed(2)}%)
`).join('\n')}`;

  // Add context as a system message
  const messagesWithContext = [...messages];
  const lastUserIndex = messagesWithContext.findLastIndex(m => m.role === 'user');
  
  messagesWithContext.splice(lastUserIndex, 0, {
    id: `context-${Date.now()}`,
    role: 'system',
    content: context
  });
  
  return messagesWithContext;
}
```

## Comparison with Current Implementation

| Feature | Current Implementation | Advanced Implementation |
|---------|------------------------|-------------------------|
| Text Extraction | Basic, format-specific | Comprehensive, format-agnostic |
| Chunking | None (whole document) | Semantic chunking with overlap |
| Storage | Raw text in Redis | Vector embeddings in Qdrant |
| Retrieval | All text provided as context | Relevant chunks retrieved by similarity |
| Relevance | None | Similarity scoring and ranking |
| Scaling | Limited by context window | Can handle large document collections |

## Next Steps for Implementation

1. Set up unstructured.io (either API access or self-hosted)
2. Deploy Qdrant (either cloud service or containerized)
3. Implement the document processing pipeline
4. Create the vector storage integration
5. Modify the chat API to use semantic search for context

This architecture will provide more sophisticated document processing and retrieval capabilities, especially when working with multiple large documents.