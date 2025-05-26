export type ChunkingStrategy = 'auto' | 'fixed' | 'semantic' | 'markdown' | 'code'

export interface ProcessingConfig {
  mode: 'local' | 'cloud'
  provider?: 'ollama' | 'openrouter'
  model?: string
  apiKey?: string
  chunkingStrategy?: ChunkingStrategy
}

export interface ProcessingPreferences {
  default: ProcessingConfig
  overrides: {
    [chatId: string]: ProcessingConfig
  }
}


export interface EmbeddingConfig {
  model: string
  dimensions: number
  provider: 'local' | 'openai' | 'cohere'
}