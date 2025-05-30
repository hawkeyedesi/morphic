/**
 * Generate search suggestions based on query and available documents
 */

export function generateSearchSuggestions(
  query: string,
  documentNames: string[],
  previousQueries?: string[]
): string[] {
  const suggestions: string[] = []
  const queryWords = query.toLowerCase().split(/\s+/)
  
  // 1. Synonym suggestions
  const synonymMap: Record<string, string[]> = {
    'document': ['file', 'paper', 'report', 'pdf'],
    'content': ['text', 'information', 'data', 'details'],
    'summary': ['overview', 'abstract', 'brief', 'synopsis'],
    'find': ['search', 'locate', 'get', 'retrieve'],
    'show': ['display', 'present', 'list', 'view']
  }
  
  // Replace words with synonyms
  queryWords.forEach(word => {
    Object.entries(synonymMap).forEach(([key, synonyms]) => {
      if (word === key || synonyms.includes(word)) {
        const alternatives = [key, ...synonyms].filter(s => s !== word)
        alternatives.forEach(alt => {
          const suggestion = query.replace(new RegExp(`\\b${word}\\b`, 'i'), alt)
          if (suggestion !== query) {
            suggestions.push(suggestion)
          }
        })
      }
    })
  })
  
  // 2. Document-specific suggestions
  if (documentNames.length > 0) {
    // Extract key terms from document names
    const docTerms = new Set<string>()
    documentNames.forEach(name => {
      // Remove extension and split by common separators
      const cleanName = name.replace(/\.[^.]+$/, '')
      const terms = cleanName.split(/[\s\-_.,]+/)
      terms.forEach(term => {
        if (term.length > 3) {
          docTerms.add(term.toLowerCase())
        }
      })
    })
    
    // Suggest queries with document terms
    docTerms.forEach(term => {
      if (!query.toLowerCase().includes(term)) {
        suggestions.push(`${query} ${term}`)
        suggestions.push(`${term} in documents`)
      }
    })
  }
  
  // 3. Query refinement suggestions
  if (queryWords.length === 1) {
    suggestions.push(`what is ${query}`)
    suggestions.push(`${query} details`)
    suggestions.push(`explain ${query}`)
  }
  
  // 4. Broaden or narrow suggestions
  if (queryWords.length > 3) {
    // Suggest shorter query
    suggestions.push(queryWords.slice(0, 2).join(' '))
  } else {
    // Suggest more specific query
    suggestions.push(`${query} technical details`)
    suggestions.push(`${query} examples`)
  }
  
  // Remove duplicates and limit
  return [...new Set(suggestions)]
    .filter(s => s.toLowerCase() !== query.toLowerCase())
    .slice(0, 5)
}

/**
 * Extract key topics from search results to suggest related queries
 */
export function extractRelatedQueries(
  results: Array<{ content: string; documentName: string }>,
  currentQuery: string
): string[] {
  const relatedQueries: string[] = []
  
  // Extract common phrases and important terms
  const importantTerms = new Set<string>()
  const phrases = new Set<string>()
  
  results.forEach(result => {
    // Extract capitalized phrases (likely important terms)
    const capitalizedMatches = result.content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g)
    capitalizedMatches?.forEach(match => {
      if (match.length > 5 && !currentQuery.includes(match)) {
        importantTerms.add(match)
      }
    })
    
    // Extract quoted phrases
    const quotedMatches = result.content.match(/"([^"]+)"/g)
    quotedMatches?.forEach(match => {
      const phrase = match.replace(/"/g, '')
      if (phrase.length > 5 && phrase.length < 50) {
        phrases.add(phrase)
      }
    })
  })
  
  // Generate queries from important terms
  importantTerms.forEach(term => {
    relatedQueries.push(`What is ${term}`)
    relatedQueries.push(`${term} details`)
  })
  
  // Generate queries from phrases
  phrases.forEach(phrase => {
    if (!currentQuery.includes(phrase)) {
      relatedQueries.push(phrase)
    }
  })
  
  // Add contextual queries based on document types
  const hasCode = results.some(r => r.content.includes('function') || r.content.includes('class'))
  const hasTechnical = results.some(r => r.content.match(/\b(API|SDK|framework|library)\b/i))
  
  if (hasCode) {
    relatedQueries.push(`${currentQuery} implementation`)
    relatedQueries.push(`${currentQuery} code examples`)
  }
  
  if (hasTechnical) {
    relatedQueries.push(`${currentQuery} architecture`)
    relatedQueries.push(`${currentQuery} best practices`)
  }
  
  return [...new Set(relatedQueries)]
    .filter(q => q.toLowerCase() !== currentQuery.toLowerCase())
    .slice(0, 5)
}