'use client'

import { useState } from 'react'
import { File, FileText, ChevronDown, ChevronUp, Trash2, Eye, Cloud, HardDrive, Info, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface DocumentCardProps {
  document: {
    id: string
    filename: string
    file_size: number
    chunk_count: number
    created_at: string
    content_preview?: string
    processing_mode?: 'simple' | 'advanced'
    chunking_strategy?: string
    embedding_type?: 'local' | 'cloud'
    embedding_dimensions?: number
  }
  onDelete: (id: string) => void
  onReprocess?: (id: string) => void
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
}

export function DocumentCard({ document, onDelete, onReprocess, selected, onSelect }: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileIcon = () => {
    const ext = document.filename.split('.').pop()?.toLowerCase()
    if (['pdf'].includes(ext || '')) return <FileText className="h-5 w-5" />
    return <File className="h-5 w-5" />
  }

  const handleDelete = () => {
    setShowDeleteDialog(false)
    onDelete(document.id)
  }

  return (
    <>
      <Card className={cn(
        "transition-all duration-200",
        expanded && "shadow-md",
        selected && "ring-2 ring-primary"
      )}>
        <div className="p-4">
          {/* Main Row */}
          <div className="flex items-start justify-between gap-3">
            {/* Selection checkbox */}
            {onSelect && (
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => onSelect(document.id, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            )}

            {/* Document info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="text-muted-foreground">
                  {getFileIcon()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{document.filename}</h4>
                  
                  {/* Metadata badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(document.file_size)}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {document.chunk_count} chunks
                    </span>
                    
                    {/* Embedding type badge */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary" className="h-5 gap-1">
                            {document.embedding_type === 'cloud' ? (
                              <Cloud className="h-3 w-3" />
                            ) : (
                              <HardDrive className="h-3 w-3" />
                            )}
                            <span className="text-[10px]">
                              {document.embedding_dimensions || (document.embedding_type === 'cloud' ? 1536 : 384)}d
                            </span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{document.embedding_type === 'cloud' ? 'OpenAI embeddings' : 'Local embeddings'}</p>
                          <p className="text-xs text-muted-foreground">
                            {document.embedding_dimensions || (document.embedding_type === 'cloud' ? 1536 : 384)} dimensions
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Processing mode badge */}
                    {document.processing_mode === 'advanced' && (
                      <Badge variant="outline" className="h-5">
                        <span className="text-[10px]">
                          {document.chunking_strategy || 'auto'}
                        </span>
                      </Badge>
                    )}
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(document.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(!expanded)}
                      className="h-8 w-8 p-0"
                    >
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {expanded ? 'Hide details' : 'Show details'}
                  </TooltipContent>
                </Tooltip>

                {onReprocess && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReprocess(document.id)}
                        className="h-8 w-8 p-0"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reprocess document</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete document</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Expanded content */}
          {expanded && (
            <div className="mt-4 pt-4 border-t">
              <div className="space-y-3">
                {/* Content preview */}
                {document.content_preview && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">Preview</h5>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {document.content_preview}
                    </p>
                  </div>
                )}

                {/* Technical details */}
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Processing Details</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Mode:</span>{' '}
                      <span className="font-medium">
                        {document.processing_mode === 'advanced' ? 'Advanced' : 'Simple'}
                      </span>
                    </div>
                    {document.processing_mode === 'advanced' && (
                      <div>
                        <span className="text-muted-foreground">Strategy:</span>{' '}
                        <span className="font-medium">{document.chunking_strategy || 'auto'}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Embeddings:</span>{' '}
                      <span className="font-medium">
                        {document.embedding_type === 'cloud' ? 'OpenAI' : 'Local'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dimensions:</span>{' '}
                      <span className="font-medium">
                        {document.embedding_dimensions || (document.embedding_type === 'cloud' ? 1536 : 384)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{document.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}