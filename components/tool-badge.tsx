import { Film, Link, Search, FileText } from 'lucide-react'
import React from 'react'
import { Badge } from './ui/badge'

type ToolBadgeProps = {
  tool?: string
  type?: string
  children?: React.ReactNode
  className?: string
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  tool,
  type,
  children,
  className
}) => {
  const toolType = tool || type || 'search'
  const icon: Record<string, React.ReactNode> = {
    search: <Search size={14} />,
    retrieve: <Link size={14} />,
    videoSearch: <Film size={14} />,
    searchDocuments: <FileText size={14} />,
    docs: <FileText size={14} />
  }

  return (
    <Badge className={className} variant={'secondary'}>
      {icon[toolType]}
      {children && <span className="ml-1">{children}</span>}
    </Badge>
  )
}
