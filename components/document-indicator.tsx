'use client'

import { FileText, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DocumentIndicatorProps {
  documentCount: number
  totalChunks?: number
  onSearchClick?: () => void
}

export function DocumentIndicator({ 
  documentCount, 
  totalChunks,
  onSearchClick 
}: DocumentIndicatorProps) {
  if (documentCount === 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-7 text-xs"
            onClick={onSearchClick}
          >
            <FileText className="h-3 w-3" />
            <span>{documentCount} document{documentCount > 1 ? 's' : ''}</span>
            {totalChunks && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {totalChunks} chunks
              </Badge>
            )}
            <Search className="h-3 w-3 ml-1 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Documents ready for search</p>
          <p className="text-xs text-muted-foreground">
            Ask questions about your uploaded documents
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Try: "What is this document about?" or "Summarize the key points"
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}