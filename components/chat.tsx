'use client'

import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { FileAttachment } from '@/lib/types/file'
import { Model } from '@/lib/types/models'
import { useChat } from '@ai-sdk/react'
import { Message } from 'ai/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat({
  id,
  savedMessages = [],
  query,
  models
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  models?: Model[]
}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    stop,
    append,
    data,
    setData,
    addToolResult,
    setInput
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    onFinish: () => {
      window.history.replaceState({}, '', `/search/${id}`)
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: false, // Disable extra message fields,
    experimental_throttle: 100
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  
  // State for file attachments
  const [attachedFiles, setAttachedFiles] = useState<Partial<FileAttachment>[]>([])

  // Manage auto-scroll and user scroll cancel
  const { anchorRef, isAutoScroll } = useAutoScroll({
    isLoading,
    dependency: messages.length,
    isStreaming: () => status === 'streaming'
  })

  useEffect(() => {
    setMessages(savedMessages)
  }, [id])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
    setAttachedFiles([]) // Clear attachments after sending a message
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setData(undefined) // reset data to clear tool call
    
    // Handle file attachments
    if (attachedFiles.length > 0) {
      const fileInfos = attachedFiles.map(file => ({
        id: file.id,
        name: file.originalName,
        type: file.mimeType
      }))
      
      // Add visible file info in message text for the user
      if (!input.startsWith('Files attached:')) {
        setInput(`Files attached: ${JSON.stringify(fileInfos)}\n\n${input}`)
      }
    }
    
    // Also modify the message in server-side extraction using metadata in our API endpoint
    // Set chat_with_file_id cookie to tell the API this chat has files
    document.cookie = `chat_with_files=${id}; path=/;`
    
    // This adds a cookie that our API will detect to know when to process files
    console.log(`[DEBUG] Setting chat_with_files cookie for ${id}`)
    
    // Proceed with normal submit
    handleSubmit(e)
    setAttachedFiles([]) // Clear attachments after sending a message
  }
  
  // Handle file attachment
  const handleAttachFiles = (files: Partial<FileAttachment>[]) => {
    setAttachedFiles([...attachedFiles, ...files])
  }
  
  // Handle file removal
  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(attachedFiles.filter(file => file.id !== fileId))
  }

  return (
    <div className="flex flex-col w-full max-w-3xl pt-14 pb-32 mx-auto stretch">
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        anchorRef={anchorRef}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
        models={models}
        isAutoScroll={isAutoScroll}
        chatId={id}
        attachedFiles={attachedFiles}
        onAttach={handleAttachFiles}
        onRemoveFile={handleRemoveFile}
      />
    </div>
  )
}
