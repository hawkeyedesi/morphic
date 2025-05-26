'use client'

import { FileText } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { ToolBadge } from './tool-badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Button } from './ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface DocumentResult {
  documentName: string
  content: string
  pageNumber?: number
  relevanceScore: number
}

export function DocumentSection({
  result,
  index
}: {
  result: any
  index: number
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  if (!result || !result.results || result.results.length === 0) {
    return (
      <Card className="p-4 mb-2">
        <div className="flex items-center gap-2 mb-2">
          <ToolBadge type="docs">Document Search</ToolBadge>
          <span className="text-sm text-muted-foreground">
            No relevant documents found
          </span>
        </div>
      </Card>
    )
  }

  const documentResults = result.results as DocumentResult[]

  return (
    <Card className="p-4 mb-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ToolBadge type="docs">Document Search</ToolBadge>
            <span className="text-sm text-muted-foreground">
              Found {documentResults.length} relevant sections
            </span>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent>
          <div className="space-y-3 mt-3">
            {documentResults.map((doc: DocumentResult, idx: number) => (
              <Card key={idx} className="p-4 border-muted bg-muted/50">
                <div className="flex items-start gap-3">
                  <FileText className="size-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm">{doc.documentName}</h3>
                      {doc.pageNumber && (
                        <Badge variant="secondary" className="text-xs">
                          Page {doc.pageNumber}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {Math.round(doc.relevanceScore * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {doc.content.length > 300 
                        ? doc.content.substring(0, 300) + '...' 
                        : doc.content}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}