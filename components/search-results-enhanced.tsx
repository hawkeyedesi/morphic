'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Search, Sparkles, Lightbulb } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { extractRelatedQueries } from '@/lib/utils/search-suggestions'

interface SearchResult {
  documentName: string
  documentId?: string
  content: string
  pageNumber?: number
  relevanceScore: number
  matchedTerms?: string[]
  chunkIndex?: number
}

interface GroupedResults {
  documentName: string
  documentId?: string
  totalMatches: number
  averageScore: number
  results: SearchResult[]
}

interface SearchResultsEnhancedProps {
  query: string
  results: SearchResult[]
  onResultClick?: (result: SearchResult) => void
  className?: string
}

export function SearchResultsEnhanced({ 
  query, 
  results, 
  onResultClick,
  className 
}: SearchResultsEnhancedProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  // Group results by document
  const groupedResults: GroupedResults[] = results.reduce((acc, result) => {
    const existingGroup = acc.find(g => g.documentName === result.documentName)
    
    if (existingGroup) {
      existingGroup.results.push(result)
      existingGroup.totalMatches++
      existingGroup.averageScore = 
        (existingGroup.averageScore * (existingGroup.totalMatches - 1) + result.relevanceScore) / 
        existingGroup.totalMatches
    } else {
      acc.push({
        documentName: result.documentName,
        documentId: result.documentId,
        totalMatches: 1,
        averageScore: result.relevanceScore,
        results: [result]
      })
    }
    
    return acc
  }, [] as GroupedResults[])

  // Sort by average relevance score
  groupedResults.sort((a, b) => b.averageScore - a.averageScore)

  const toggleDocument = (docName: string) => {
    setExpandedDocs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(docName)) {
        newSet.delete(docName)
      } else {
        newSet.add(docName)
      }
      return newSet
    })
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    
    // Extract meaningful terms (ignore common words)
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'some', 'any', 'few', 'more', 'most', 'other', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once']
    
    const terms = query.toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.includes(t))
    
    if (terms.length === 0) return text
    
    // Create regex pattern that matches word boundaries
    const pattern = terms
      .map(term => `\\b${term}\\w*\\b`)  // Match term and its variations
      .join('|')
    
    const regex = new RegExp(`(${pattern})`, 'gi')
    
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
  }

  const displayGroups = showAll ? groupedResults : groupedResults.slice(0, 3)
  
  // Extract related queries from results
  const relatedQueries = results.length > 0 
    ? extractRelatedQueries(results, query) 
    : []

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Found {results.length} results across {groupedResults.length} documents
          </h3>
        </div>
        {groupedResults.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show less' : `Show all ${groupedResults.length} documents`}
          </Button>
        )}
      </div>

      {/* Grouped results */}
      <div className="space-y-3">
        {displayGroups.map((group) => {
          const isExpanded = expandedDocs.has(group.documentName)
          const displayResults = isExpanded ? group.results : group.results.slice(0, 2)
          
          return (
            <Card key={group.documentName} className="overflow-hidden">
              {/* Document header */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50"
                onClick={() => toggleDocument(group.documentName)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">{group.documentName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {group.totalMatches} match{group.totalMatches > 1 ? 'es' : ''}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          group.averageScore > 0.7 ? "text-green-600 border-green-600" :
                          group.averageScore > 0.5 ? "text-yellow-600 border-yellow-600" :
                          "text-muted-foreground"
                        )}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {(group.averageScore * 100).toFixed(0)}% relevant
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Results */}
              <div className="border-t">
                {displayResults.map((result, idx) => (
                  <div
                    key={`${result.documentName}-${idx}`}
                    className={cn(
                      "p-4 text-sm cursor-pointer hover:bg-accent/30",
                      idx > 0 && "border-t"
                    )}
                    onClick={() => onResultClick?.(result)}
                  >
                    {result.pageNumber && (
                      <Badge variant="outline" className="text-xs mb-2">
                        Page {result.pageNumber}
                      </Badge>
                    )}
                    <p 
                      className="text-muted-foreground line-clamp-3"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightText(result.content, query) 
                      }}
                    />
                  </div>
                ))}
                
                {/* Show more results button */}
                {!isExpanded && group.results.length > 2 && (
                  <div className="px-4 py-2 border-t bg-muted/30">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDocument(group.documentName)
                      }}
                    >
                      Show {group.results.length - 2} more results
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* No results message with suggestions */}
      {results.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No results found for "{query}"
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try different keywords or upload more documents
          </p>
          
          {/* Search suggestions could be added here */}
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Suggestions:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge 
                variant="secondary" 
                className="cursor-pointer hover:bg-secondary/80"
              >
                Try broader terms
              </Badge>
              <Badge 
                variant="secondary" 
                className="cursor-pointer hover:bg-secondary/80"
              >
                Check document names
              </Badge>
            </div>
          </div>
        </Card>
      )}
      
      {/* Related searches */}
      {relatedQueries.length > 0 && results.length > 0 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Related searches</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {relatedQueries.map((relatedQuery, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="cursor-pointer hover:bg-background hover:shadow-sm transition-all"
                onClick={() => {
                  // In a real implementation, this would trigger a new search
                  console.log('Related search:', relatedQuery)
                }}
              >
                {relatedQuery}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}