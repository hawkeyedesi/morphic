'use client'

import { FileText } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { ToolBadge } from './tool-badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Button } from './ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { SearchResultsEnhanced } from './search-results-enhanced'

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
  const query = result.query || ''

  return (
    <Card className="p-4 mb-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ToolBadge type="docs">Document Search</ToolBadge>
            <span className="text-sm text-muted-foreground">
              Searching for: "{query}"
            </span>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent>
          <div className="mt-3">
            <SearchResultsEnhanced 
              query={query}
              results={documentResults}
              onResultClick={(result) => {
                // Could open document viewer or scroll to result
                console.log('Clicked result:', result)
              }}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}