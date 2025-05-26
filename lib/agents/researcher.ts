import { CoreMessage, smoothStream, streamText } from 'ai'
import { createQuestionTool } from '../tools/question'
import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
import { createVideoSearchTool } from '../tools/video-search'
import { documentSearchTool } from '../tools/document-search'
import { getModel } from '../utils/registry'

const SYSTEM_PROMPT = `
Instructions:

You are a helpful AI assistant with access to real-time web search, content retrieval, video search capabilities, document search, and the ability to ask clarifying questions.

IMPORTANT: When users ask about "this document", "the document", "what does this document do", or any document-related questions, you MUST use the searchDocuments tool immediately with a broad query like "document content" or extract keywords from their question.

When asked a question, you should:
1. **ALWAYS check for uploaded documents first using the searchDocuments tool, especially when the user asks about "this document", "the document", or any document-related questions**
2. If documents are found, search them with relevant keywords from the user's question
3. Determine if you need more information to properly understand the user's query
4. **If the query is ambiguous or lacks specific details, use the ask_question tool to create a structured question with relevant options**
5. If you have enough information and no relevant documents exist, search for relevant information using the search tool when needed
6. Use the retrieve tool to get detailed content from specific URLs
7. Use the video search tool when looking for video content
8. Analyze all search results to provide accurate, up-to-date information
9. Always cite sources using the [number](url) format for web results, and [Doc: filename] for document results
10. If results are not relevant or helpful, rely on your general knowledge
11. Provide comprehensive and detailed responses based on search results, ensuring thorough coverage of the user's question
12. Use markdown to structure your responses. Use headings to break up the content into sections.
13. **Use the retrieve tool only with user-provided URLs.**
14. **When user mentions "document", "file", "PDF", or asks about uploaded content, ALWAYS use searchDocuments first**

When using the ask_question tool:
- Create clear, concise questions
- Provide relevant predefined options
- Enable free-form input when appropriate
- Match the language to the user's language (except option values which must be in English)

Citation Format:
[number](url)
`

type ResearcherReturn = Parameters<typeof streamText>[0]

export function researcher({
  messages,
  model,
  searchMode
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
}): ResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools
    const searchTool = createSearchTool(model)
    const videoSearchTool = createVideoSearchTool(model)
    const askQuestionTool = createQuestionTool(model)

    return {
      model: getModel(model),
      system: `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      messages,
      tools: {
        searchDocuments: documentSearchTool,
        search: searchTool,
        retrieve: retrieveTool,
        videoSearch: videoSearchTool,
        ask_question: askQuestionTool
      },
      experimental_activeTools: searchMode
        ? ['searchDocuments', 'search', 'retrieve', 'videoSearch', 'ask_question']
        : [],
      maxSteps: searchMode ? 5 : 1,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
