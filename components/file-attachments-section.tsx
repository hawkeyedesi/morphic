import { FileAttachment as FileAttachmentType } from '@/lib/types/file'
import { cn } from '@/lib/utils'
import { Paperclip, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FileAttachment } from './file-attachment'
import { FileUpload } from './file-upload'
import { Button } from './ui/button'

interface FileAttachmentsSectionProps {
  chatId: string
  isDisabled?: boolean
  onAttach?: (files: Partial<FileAttachmentType>[]) => void
  attachedFiles?: Partial<FileAttachmentType>[]
  onRemove?: (fileId: string) => void
  className?: string
}

export function FileAttachmentsSection({
  chatId,
  isDisabled = false,
  onAttach,
  attachedFiles = [],
  onRemove,
  className
}: FileAttachmentsSectionProps) {
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [files, setFiles] = useState<Partial<FileAttachmentType>[]>(attachedFiles)
  
  // Update files when attachedFiles prop changes
  useEffect(() => {
    setFiles(attachedFiles)
  }, [attachedFiles])
  
  // Handle upload completion
  const handleUploadComplete = (uploadedFiles: Partial<FileAttachmentType>[]) => {
    // Hide upload form
    setShowUploadForm(false)
    
    // Add new files to state
    const newFiles = [...files, ...uploadedFiles]
    setFiles(newFiles)
    
    // Call callback if provided
    if (onAttach) {
      onAttach(uploadedFiles)
    }
  }
  
  // Handle file removal
  const handleRemoveFile = (fileId: string) => {
    // Remove file from state
    const newFiles = files.filter(file => file.id !== fileId)
    setFiles(newFiles)
    
    // Call callback if provided
    if (onRemove) {
      onRemove(fileId)
    }
  }
  
  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Attached files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <FileAttachment
              key={file.id || index}
              file={file}
              isEditable={!isDisabled}
              onRemove={handleRemoveFile}
            />
          ))}
        </div>
      )}
      
      {/* Upload button */}
      {!isDisabled && (
        <div className="mt-2">
          {!showUploadForm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowUploadForm(true)}
            >
              <Paperclip className="h-4 w-4" />
              Attach files
            </Button>
          ) : (
            <div className="space-y-2 p-3 border rounded-md">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Attach files</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowUploadForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FileUpload
                chatId={chatId}
                onUploadComplete={handleUploadComplete}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}