# Future Enhancements

This document tracks potential future improvements and features for the Morphic fork.

## 🚀 Planned Enhancements

### Advanced Document Processing

- [ ] **Smart Chunking Strategies**
  - Semantic chunking (respect paragraphs/sentences)
  - Document-aware chunking (markdown headers, code blocks)
  - Recursive chunking for optimal sizes
  - Language-specific chunking for code files

- [ ] **Enhanced Embeddings**
  - Support for larger embedding models (768/1024 dims)
  - Hybrid search (dense + sparse embeddings)
  - Multi-lingual embedding support
  - Custom fine-tuned embeddings

- [ ] **Flexible Processing Backend**
  - Toggle between local (Ollama) and cloud (OpenRouter)
  - Per-chat processing preferences
  - Automatic fallback when local unavailable
  - Cost tracking for cloud processing

- [ ] **Document Intelligence**
  - Table extraction from PDFs
  - Form field recognition
  - Metadata extraction (author, date, etc.)
  - Cross-reference detection

### Document Management

- [ ] **Project-based Document Sharing**
  - Allow users to create "projects" with shared document contexts
  - Switch between chat-scoped and project-scoped document storage
  - Share document collections across multiple chats within a project
  - Use cases: Research projects, ongoing work with related documents

- [ ] **Document Organization**
  - Add folders/categories for uploaded documents
  - Tag documents for better organization
  - Search within document filenames and metadata

- [ ] **Enhanced Document Support**
  - Add support for more file types (Excel, PowerPoint, etc.)
  - Support for larger documents (currently 10MB limit)
  - Batch document upload
  - Document preview before upload

### AI & Search Improvements

- [ ] **Multi-modal Enhancements**
  - Support for video analysis (when models become available)
  - Audio transcription and analysis
  - Better OCR with language detection

- [ ] **Search Refinements**
  - Hybrid search (keyword + semantic)
  - Filter search results by document type
  - Date-based filtering for documents

### User Experience

- [ ] **Document Management UI**
  - Better visualization of uploaded documents
  - Drag and drop to reorder
  - Quick document preview
  - Bulk operations (delete multiple)

- [ ] **Persistence & Sync**
  - Optional cloud backup for documents
  - Export/import document collections
  - Share document sets via links

### Performance

- [ ] **Optimization**
  - Lazy loading for large document collections
  - Background processing for large files
  - Incremental indexing
  - Caching for frequently accessed documents

## 📝 Notes

- Current implementation uses chat-scoped documents (like Claude.ai)
- All processing is local for privacy
- Uses JSON storage for simplicity (could migrate to SQLite for scale)

## 🤝 Contributing

Feel free to add more ideas or pick up any of these enhancements!