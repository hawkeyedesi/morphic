'use client'

import { useState, useEffect } from 'react'
import { Upload, File, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chatId', chatId)
      
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
      
      // Refresh the document list
      fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
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

  // Load documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [])

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