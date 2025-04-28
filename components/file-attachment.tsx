import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FileAttachment as FileAttachmentType } from '@/lib/types/file'
import {
    Download,
    ExternalLink,
    File,
    FileText,
    Image as ImageIcon,
    Loader2,
    Trash
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface FileAttachmentProps {
  file: Partial<FileAttachmentType>
  onRemove?: (fileId: string) => void
  showActions?: boolean
  isEditable?: boolean
}

export function FileAttachment({
  file,
  onRemove,
  showActions = true,
  isEditable = false
}: FileAttachmentProps) {
  const [loading, setLoading] = useState(false)
  const [showTextPreview, setShowTextPreview] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  
  // Get file icon based on MIME type
  const getFileIcon = () => {
    if (!file.mimeType) return <File className="h-4 w-4" />
    
    if (file.mimeType.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />
    }
    
    if (
      file.mimeType === 'text/plain' ||
      file.mimeType === 'text/markdown' ||
      file.mimeType === 'text/html' ||
      file.mimeType === 'application/json' ||
      file.mimeType === 'application/pdf' ||
      file.mimeType.includes('document')
    ) {
      return <FileText className="h-4 w-4" />
    }
    
    return <File className="h-4 w-4" />
  }
  
  // Format file size
  const formatFileSize = (size?: number) => {
    if (!size) return 'Unknown size'
    
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
  
  // Handle file download
  const handleDownload = async () => {
    if (!file.id) return
    
    setLoading(true)
    
    try {
      const response = await fetch(`/api/attachments/${file.id}?download=true`)
      
      if (!response.ok) {
        throw new Error('Failed to download file')
      }
      
      // Create a blob from the response
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.originalName || 'download'
      document.body.appendChild(a)
      a.click()
      
      // Clean up
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    } finally {
      setLoading(false)
    }
  }
  
  // Handle file removal
  const handleRemove = async () => {
    if (!file.id || !onRemove) return
    
    setLoading(true)
    
    try {
      const response = await fetch(`/api/attachments/${file.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to remove file')
      }
      
      onRemove(file.id)
      toast.success('File removed successfully')
    } catch (error) {
      console.error('Error removing file:', error)
      toast.error('Failed to remove file')
    } finally {
      setLoading(false)
    }
  }
  
  // Handle text preview
  const handleTextPreview = async () => {
    if (!file.id) return
    
    if (textContent) {
      setShowTextPreview(true)
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch(`/api/attachments/${file.id}?metadata=true`)
      
      if (!response.ok) {
        throw new Error('Failed to get file metadata')
      }
      
      const data = await response.json()
      
      if (data.extractedText) {
        setTextContent(data.extractedText)
        setShowTextPreview(true)
      } else if (data.processingStatus === 'pending' || data.processingStatus === 'processing') {
        toast.info('File content is still being processed')
      } else {
        toast.error('No text content available for this file')
      }
    } catch (error) {
      console.error('Error getting file metadata:', error)
      toast.error('Failed to retrieve file content')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <>
      <div className="flex items-center gap-2 p-2 border rounded-md bg-secondary/20 w-full max-w-sm">
        <div className="flex-shrink-0">{getFileIcon()}</div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" title={file.originalName}>
            {file.originalName}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </div>
        </div>
        
        {showActions && (
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleTextPreview}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Preview content</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {isEditable && onRemove && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleRemove}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>
      
      {/* Text preview dialog */}
      <Dialog open={showTextPreview} onOpenChange={setShowTextPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{file.originalName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 whitespace-pre-wrap font-mono text-sm bg-secondary/20 p-4 rounded-md max-h-[60vh] overflow-auto">
            {textContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}