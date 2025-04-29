# Docling Integration

This document outlines how to use Docling as an alternative document processing library for Morphic, particularly on platforms where unstructured.io may not be fully supported (such as Apple Silicon).

## What is Docling?

Docling is an open-source document processing library that provides similar capabilities to unstructured.io:

- Document parsing and text extraction
- Semantic chunking with configurable overlap
- Metadata extraction
- Support for multiple document formats

Docling is designed to be lightweight and portable, making it a good alternative for platforms where unstructured.io may have compatibility issues.

## Why Use Docling?

- **Cross-platform compatibility**: Works reliably on ARM64 architectures like Apple Silicon
- **Open source**: Completely free to use and modify
- **Lightweight**: Smaller footprint than running unstructured.io in Docker
- **Python-free**: No Python dependencies required if using the Node.js version
- **Similar API**: Designed to be a drop-in replacement for unstructured.io

## Installation

### Option 1: Install via NPM (Recommended)

```bash
npm install docling
# or
yarn add docling
```

### Option 2: Use Docling Docker Image

```bash
docker pull docling/docling:latest
docker run -p 3000:3000 docling/docling:latest
```

## Configuration

To enable Docling in your Morphic setup, add the following to your `.env.local` file:

```
# Enable Docling as document processor
USE_DOCLING=true
```

You can also configure Docling to be used only as a fallback:

```
# Try unstructured.io first, fall back to Docling if needed
ENABLE_PYTHON_FALLBACK=true
USE_DOCLING=true
```

## Basic Usage

Docling is integrated into the advanced file processing pipeline and will be used automatically when enabled. However, you can also use it directly in your code:

```typescript
import { processDocument } from 'docling';

// Process a document
const result = await processDocument(fileBuffer, {
  filename: 'document.pdf',
  chunkSize: 1000,
  chunkOverlap: 200
});

// Access the chunks
const chunks = result.chunks;
```

## Docling API Reference

### processDocument(fileBuffer, options)

Processes a document and returns chunks with metadata.

**Parameters:**
- `fileBuffer`: Buffer - The file buffer to process
- `options`: Object - Processing options
  - `filename`: String - The name of the file (used to determine file type)
  - `chunkSize`: Number - The maximum size of each chunk (default: 1000)
  - `chunkOverlap`: Number - The amount of overlap between chunks (default: 200)
  - `strategy`: String - Processing strategy ('auto', 'text', 'pdf', etc.)

**Returns:**
A Promise that resolves to an object with:
- `chunks`: Array of document chunks
- `metadata`: Document metadata

### Example Chunks Format

```json
{
  "chunks": [
    {
      "id": "chunk-0",
      "text": "This is the content of the first chunk...",
      "type": "NarrativeText",
      "pageNumber": 1,
      "metadata": {
        "source": "document.pdf",
        "confidence": 0.95
      }
    },
    {
      "id": "chunk-1",
      "text": "This is the content of the second chunk...",
      "type": "NarrativeText",
      "pageNumber": 1,
      "metadata": {
        "source": "document.pdf",
        "confidence": 0.92
      }
    }
  ],
  "metadata": {
    "title": "Example Document",
    "author": "John Doe",
    "created": "2025-04-01T12:00:00Z",
    "pageCount": 5
  }
}
```

## Integrating Docling with Morphic

The `advanced-file-processor.ts` file has been updated to use Docling as one of the fallback options in the document processing pipeline.

### Integration Flow

1. The system first tries to use unstructured.io (via Docker or cloud API)
2. If that fails, it tries the Python fallback (if enabled)
3. If Python fallback fails or is not enabled, it tries Docling (if enabled)
4. If all else fails, it falls back to the basic processing

## Performance Comparison

Initial testing suggests the following performance characteristics:

| Feature | unstructured.io | Docling | Basic Fallback |
|---------|----------------|---------|----------------|
| Text Extraction | Excellent | Very Good | Basic |
| Table Extraction | Excellent | Good | None |
| Image Support | Yes | Partial | No |
| Chunking Quality | Excellent | Very Good | Basic |
| Processing Speed | Moderate | Fast | Very Fast |
| Memory Usage | High | Low | Very Low |
| Platform Support | Limited on ARM64 | All Platforms | All Platforms |

## Troubleshooting

### Common Issues

1. **Module not found error**:
   ```
   Error: Cannot find module 'docling'
   ```
   - Solution: Ensure you've installed Docling with `npm install docling`

2. **Processing fails for certain file types**:
   - Solution: Check if the file format is supported or try converting to PDF

3. **Performance issues on large documents**:
   - Solution: Adjust chunk size or use batch processing for very large files

## Future Enhancements

Future improvements to the Docling integration may include:

1. Custom chunking strategies tailored to specific document types
2. Improved table and image extraction
3. Optimized memory usage for very large documents
4. Direct integration with Qdrant for vector storage

## Contributing to Docling

As an open-source project, Docling welcomes contributions. If you encounter issues or want to add features, please consider contributing to the project:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## More Information

For more details on the multi-platform document processing approach, see:
- [MULTI_PLATFORM_PROCESSING.md](./MULTI_PLATFORM_PROCESSING.md)
- [IMPLEMENT_ADVANCED_PROCESSING.md](./IMPLEMENT_ADVANCED_PROCESSING.md)