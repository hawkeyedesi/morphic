'use client'

import { Cloud, HardDrive } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'

interface ProcessingModeToggleProps {
  chatId?: string
  onModeChange?: (mode: 'local' | 'cloud') => void
}

export function ProcessingModeToggle({ chatId, onModeChange }: ProcessingModeToggleProps) {
  const [isCloudMode, setIsCloudMode] = useState(false)
  
  useEffect(() => {
    // Load preference from localStorage
    const stored = localStorage.getItem(`processing-mode-${chatId || 'default'}`)
    if (stored === 'cloud') {
      setIsCloudMode(true)
    }
  }, [chatId])
  
  const handleToggle = (checked: boolean) => {
    const mode = checked ? 'cloud' : 'local'
    setIsCloudMode(checked)
    
    // Save preference
    localStorage.setItem(`processing-mode-${chatId || 'default'}`, mode)
    
    // Notify parent
    onModeChange?.(mode)
  }
  
  return (
    <TooltipProvider>
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="processing-mode"
                checked={isCloudMode}
                onCheckedChange={handleToggle}
              />
              <Cloud className="h-4 w-4 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold mb-1">
              {isCloudMode ? 'Cloud Processing' : 'Local Processing'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCloudMode 
                ? 'Using OpenRouter for better accuracy'
                : 'Using Ollama for privacy'}
            </p>
          </TooltipContent>
        </Tooltip>
        <Label htmlFor="processing-mode" className="text-xs text-muted-foreground">
          {isCloudMode ? 'Cloud' : 'Local'}
        </Label>
      </div>
    </TooltipProvider>
  )
}