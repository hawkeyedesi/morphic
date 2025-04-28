import { Button } from '@/components/ui/button'
import { FileAttachment } from '@/lib/types/file'
import { AlertCircle, File, FileUp, Loader2, Trash, Upload } from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

interface FileUploadProps {
  chatId: string
  onUploadComplete: (files: Partial<FileAttachment>[]) => void
  maxFiles?: number
  maxSize?: number // in bytes
}

export function FileUpload({
  chatId,
  onUploadComplete,
  maxFiles = 3,
  maxSize = 10 * 1024 * 1024, // 10MB
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Validate files
  const validateFiles = useCallback((selectedFiles: File[]): { valid: boolean; errors: string[] } => {
    const newErrors: string[] = []
    
    // Validate the number of files
    if (selectedFiles.length + files.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed`)
      return { valid: false, errors: newErrors }
    }
    
    // Validate file sizes
    const oversizedFiles = selectedFiles.filter(file => file.size > maxSize)
    if (oversizedFiles.length > 0) {
      newErrors.push(
        `${oversizedFiles.length} file(s) exceed the maximum size of ${Math.floor(maxSize / (1024 * 1024))}MB`
      )
      return { valid: false, errors: newErrors }
    }
    
    return { valid: true, errors: [] }
  }, [files.length, maxFiles, maxSize])
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setErrors([]) // Reset errors
    
    const validation = validateFiles(selectedFiles)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    
    setFiles([...files, ...selectedFiles])
    
    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setErrors([]) // Reset errors
    
    if (uploading || files.length >= maxFiles) return
    
    // Get files from drop event
    const droppedFiles = Array.from(e.dataTransfer.files)
    
    const validation = validateFiles(droppedFiles)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    
    setFiles([...files, ...droppedFiles])
  }
  
  // Remove a file from the list
  const removeFile = (index: number) => {
    const newFiles = [...files]
    newFiles.splice(index, 1)
    setFiles(newFiles)
  }
  
  // Upload files to the server
  const uploadFiles = async () => {
    if (files.length === 0) return
    
    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('chatId', chatId)
      
      files.forEach(file => {
        formData.append('files', file)
      })
      
      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload files')
      }
      
      const data = await response.json()
      
      // Process each uploaded file to extract content
      const uploadedFiles = data.files.filter((f: any) => f.success)
      
      // Process files to extract text content
      for (const file of uploadedFiles) {
        console.log(`[DEBUG] Processing file ${file.id}`)
        try {
          await fetch('/api/attachments/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileId: file.id }),
          })
          console.log(`[DEBUG] Successfully initiated processing for file ${file.id}`)
        } catch (error) {
          console.error(`[ERROR] Failed to process file ${file.id}:`, error)
        }
      }
      
      // Notify success
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`)
      
      // Clear file list
      setFiles([])
      
      // Call callback with uploaded files
      onUploadComplete(uploadedFiles)
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Failed to upload files')
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div className="w-full space-y-4">
      {/* Drag and drop area */}
      <div
        ref={dropZoneRef}
        className={`w-full border-2 border-dashed rounded-md p-6 transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Drag and drop files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Upload up to {maxFiles} files (max {Math.floor(maxSize / (1024 * 1024))}MB each)
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || files.length >= maxFiles}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Select Files
          </Button>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          multiple
          accept="application/pdf,text/plain,text/markdown,text/html,application/json,image/jpeg,image/png,image/gif,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={uploading || files.length >= maxFiles}
        />
      </div>
      
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        
        {files.length > 0 && (
          <Button
            variant="default"
            size="sm"
            onClick={uploadFiles}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Upload {files.length} {files.length === 1 ? 'file' : 'files'}
              </>
            )}
          </Button>
        )}
      </div>
      
      {/* Error messages */}
      {errors.length > 0 && (
        <div className="text-sm text-red-500 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            {errors.map((error, i) => (
              <div key={i}>{error}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-2 border rounded-md">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <div className="text-sm font-medium truncate max-w-[200px]">
                  {file.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFile(i)}
                disabled={uploading}
              >
                <Trash className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}