import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string
  }
  className?: string
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  className = "" 
}: StatsCardProps) {
  return (
    <Card className={`p-6 bg-white border border-border hover:shadow-md transition-shadow ${className}`}>
      {/* Header with icon and title */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 bg-surface rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-text-secondary">{title}</span>
      </div>

      {/* Main value */}
      <div className="mb-2">
        <span className="text-2xl font-semibold text-text-primary">{value}</span>
      </div>

      {/* Subtitle and trend */}
      <div className="flex items-center justify-between">
        {subtitle && (
          <span className="text-xs text-text-muted">{subtitle}</span>
        )}
        {trend && (
          <div className={`text-xs font-medium flex items-center gap-1 ${
            trend.direction === 'up' ? 'text-success' :
            trend.direction === 'down' ? 'text-error' :
            'text-text-muted'
          }`}>
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </Card>
  )
}