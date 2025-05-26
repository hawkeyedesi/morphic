'use client'

import { useState, useEffect } from 'react'
import { Upload, File, X, AlertCircle, Settings2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface UploadedDocument {
  id: string
  filename: string
  file_size: number
  chunk_count: number
  created_at: string
}

interface DocumentUploadProps {
  chatId: string
}

export function DocumentUpload({ chatId }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocument[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(true) // Show by default
  const [useAdvancedProcessing, setUseAdvancedProcessing] = useState(true) // ON by default
  const [chunkingStrategy, setChunkingStrategy] = useState<string>('auto')
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [cloudMode, setCloudMode] = useState<boolean>(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = async (files: FileList) => {
    setError(null)
    const file = files[0] // Handle one file at a time for now
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    setError(null)
    setProcessingStatus('Preparing upload...')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chatId', chatId)
      
      // Check processing mode from localStorage
      const storedMode = localStorage.getItem(`processing-mode-${chatId}`)
      console.log('🔍 Processing mode from localStorage:', storedMode)
      
      // Determine processing configuration
      let processingInfo = ''
      if (useAdvancedProcessing) {
        // Always send chunking strategy when using advanced
        formData.append('chunkingStrategy', chunkingStrategy)
        
        // Check if cloud mode is enabled
        if (storedMode === 'cloud') {
          formData.append('processingMode', 'cloud')
          processingInfo = `Advanced (${chunkingStrategy} chunking) + Cloud embeddings`
        } else {
          formData.append('processingMode', 'advanced')
          processingInfo = `Advanced (${chunkingStrategy} chunking) + Local embeddings`
        }
      } else if (storedMode === 'cloud') {
        // If not using advanced but cloud mode is selected, use cloud for embeddings
        formData.append('processingMode', 'cloud')
        processingInfo = 'Simple + Cloud embeddings'
      } else {
        // Simple local processing (default)
        processingInfo = 'Simple + Local embeddings'
      }
      
      setProcessingStatus(`Uploading with ${processingInfo}...`)
      
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }
      
      const { document } = await response.json()
      setUploadedFiles(prev => [...prev, document])
      setProcessingStatus('Upload complete!')
      
      // Refresh the document list
      fetchDocuments()
      
      // Clear status after 3 seconds
      setTimeout(() => setProcessingStatus(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setProcessingStatus('')
    } finally {
      setIsUploading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?chatId=${chatId}`)
      if (response.ok) {
        const { documents } = await response.json()
        setUploadedFiles(documents)
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    }
  }

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}?chatId=${chatId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setUploadedFiles(prev => prev.filter(doc => doc.id !== documentId))
      }
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  // Load documents on mount and check cloud mode
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch(`/api/documents?chatId=${chatId}`)
        if (response.ok) {
          const { documents } = await response.json()
          setUploadedFiles(documents)
        }
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
    }
    
    loadDocuments()
    
    // Check cloud mode from localStorage
    const checkCloudMode = () => {
      const mode = localStorage.getItem(`processing-mode-${chatId}`)
      setCloudMode(mode === 'cloud')
    }
    
    checkCloudMode()
    
    // Listen for storage changes
    window.addEventListener('storage', checkCloudMode)
    return () => window.removeEventListener('storage', checkCloudMode)
  }, [chatId])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={cn(
          'border-2 border-dashed p-8 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          isUploading && 'opacity-50 pointer-events-none'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">
          Drop your documents here or click to upload
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Supports PDF, DOC, DOCX, TXT, MD, PNG, JPG, and JPEG files (max 10MB)
        </p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
          onChange={handleFileInput}
          disabled={isUploading}
        />
        <Button asChild disabled={isUploading}>
          <label htmlFor="file-upload" className="cursor-pointer">
            {isUploading ? 'Uploading...' : 'Select File'}
          </label>
        </Button>
      </Card>

      {/* Processing Status */}
      {processingStatus && (
        <div className="text-sm text-muted-foreground text-center animate-pulse">
          {processingStatus}
        </div>
      )}

      {/* Advanced Options */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Settings2 className="h-4 w-4" />
            <h3 className="text-sm font-medium">Processing Options</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'}
          </Button>
        </div>
        
        {showAdvanced && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="advanced-processing" className="text-sm">
                Use Advanced Processing
              </Label>
              <Switch
                id="advanced-processing"
                checked={useAdvancedProcessing}
                onCheckedChange={setUseAdvancedProcessing}
              />
            </div>
            
            {useAdvancedProcessing && (
              <div className="space-y-2">
                <Label htmlFor="chunking-strategy" className="text-sm">
                  Chunking Strategy
                </Label>
                <Select value={chunkingStrategy} onValueChange={setChunkingStrategy}>
                  <SelectTrigger id="chunking-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="semantic">Semantic</SelectItem>
                    <SelectItem value="fixed">Fixed Size</SelectItem>
                    <SelectItem value="markdown">Markdown-aware</SelectItem>
                    <SelectItem value="code">Code-aware</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Auto-detect will choose the best strategy based on your document type
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Current Mode Display */}
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm">
          <strong>Current mode:</strong>{' '}
          {useAdvancedProcessing ? (
            <>
              Advanced processing with <strong>{chunkingStrategy}</strong> chunking
              {cloudMode 
                ? ' + Cloud embeddings (OpenRouter)' 
                : ' + Local embeddings (Xenova)'}
            </>
          ) : (
            <>
              Simple processing
              {cloudMode 
                ? ' + Cloud embeddings (OpenRouter)' 
                : ' + Local embeddings (Xenova)'}
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Uploaded Documents */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Uploaded Documents ({uploadedFiles.length})
          </h3>
          {uploadedFiles.map((doc) => (
            <Card key={doc.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <File className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)} • {doc.chunk_count} chunks
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDocument(doc.id)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}