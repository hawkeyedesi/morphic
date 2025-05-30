'use client'

import { ChatRequestOptions } from 'ai'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { MessageActions } from './message-actions'
import { ReasoningSection } from './reasoning-section'
import { useMemo, useState } from 'react'

export type AnswerSectionProps = {
  content: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chatId?: string
  showActions?: boolean
  messageId: string
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

export function AnswerSection({
  content,
  isOpen,
  onOpenChange,
  chatId,
  showActions = true, // Default to true for backward compatibility
  messageId,
  reload
}: AnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'
  const [thinkingOpen, setThinkingOpen] = useState(false)

  // Parse thinking tokens from content
  const { mainContent, thinkingContent } = useMemo(() => {
    if (!content) return { mainContent: '', thinkingContent: '' }
    
    // Match <think>...</think> tags (including multiline content)
    const thinkPattern = /<think>([\s\S]*?)<\/think>/g
    const matches = content.match(thinkPattern)
    
    if (!matches) {
      return { mainContent: content, thinkingContent: '' }
    }
    
    // Extract all thinking content
    const thinkingParts = matches.map(match => 
      match.replace(/<\/?think>/g, '').trim()
    )
    
    // Remove thinking tags from main content
    const cleanContent = content.replace(thinkPattern, '').trim()
    
    return {
      mainContent: cleanContent,
      thinkingContent: thinkingParts.join('\n\n')
    }
  }, [content])

  const handleReload = () => {
    if (reload) {
      return reload(messageId)
    }
    return Promise.resolve(undefined)
  }

  const message = content ? (
    <div className="flex flex-col gap-2">
      {thinkingContent && (
        <ReasoningSection
          content={{
            reasoning: thinkingContent,
            time: undefined // We don't have timing info for think tokens
          }}
          isOpen={thinkingOpen}
          onOpenChange={setThinkingOpen}
        />
      )}
      {mainContent && (
        <div className="flex flex-col gap-1">
          <BotMessage message={mainContent} />
          {showActions && (
            <MessageActions
              message={mainContent} // Keep original message content for copy
              messageId={messageId}
              chatId={chatId}
              enableShare={enableShare}
              reload={handleReload}
            />
          )}
        </div>
      )}
    </div>
  ) : (
    <DefaultSkeleton />
  )
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={false}
      showIcon={false}
    >
      {message}
    </CollapsibleMessage>
  )
}
