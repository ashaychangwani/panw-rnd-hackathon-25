import { BlogStatus } from '@/types/blog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusIndicatorProps {
  status: BlogStatus
  className?: string
}

const statusConfig = {
  active: {
    label: 'Active',
    variant: 'success' as const,
    pulse: true,
    dotColor: 'bg-success'
  },
  paused: {
    label: 'Paused',
    variant: 'warning' as const,
    pulse: false,
    dotColor: 'bg-warning'
  },
  error: {
    label: 'Error',
    variant: 'error' as const,
    pulse: false,
    dotColor: 'bg-error'
  },
  checking: {
    label: 'Checking',
    variant: 'info' as const,
    pulse: true,
    dotColor: 'bg-info'
  }
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = statusConfig[status]
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div 
        className={cn(
          "h-2 w-2 rounded-full",
          config.dotColor,
          config.pulse && "animate-pulse"
        )}
      />
      <Badge variant={config.variant} className="text-xs font-medium">
        {config.label}
      </Badge>
    </div>
  )
}