'use client'

import { useState, useEffect } from 'react'
import { IntelligenceSource, ThreatCategory } from '@/types/orchestration'
import { 
  Globe, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface IntelligenceSourceCardProps {
  source: IntelligenceSource
  onToggle?: (sourceId: string) => void
  onRemove?: (sourceId: string) => void
  onSimulateThreat?: (sourceId: string) => void
}

export function IntelligenceSourceCard({ 
  source, 
  onToggle, 
  onRemove, 
  onSimulateThreat 
}: IntelligenceSourceCardProps) {
  const [isClient, setIsClient] = useState(false)
  const [lastCheckedText, setLastCheckedText] = useState('Loading...')

  useEffect(() => {
    setIsClient(true)
    
    const updateLastChecked = () => {
      if (!source.lastChecked) {
        setLastCheckedText('Never')
        return
      }
      
      const now = new Date()
      const diff = now.getTime() - source.lastChecked.getTime()
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      
      if (hours > 0) {
        setLastCheckedText(`${hours}h ago`)
      } else if (minutes > 0) {
        setLastCheckedText(`${minutes}m ago`)
      } else {
        setLastCheckedText(`${seconds}s ago`)
      }
    }
    
    // Initial update
    updateLastChecked()
    
    // Update every 30 seconds
    const interval = setInterval(updateLastChecked, 30000)
    
    return () => clearInterval(interval)
  }, [source.lastChecked])

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusIcon = (isActive: boolean) => {
    return isActive 
      ? <CheckCircle className="w-4 h-4" />
      : <XCircle className="w-4 h-4" />
  }

  const getCategoryColor = (category: ThreatCategory) => {
    switch (category) {
      case 'malware': return 'bg-red-100 text-red-800'
      case 'ransomware': return 'bg-purple-100 text-purple-800'
      case 'apt': return 'bg-orange-100 text-orange-800'
      case 'vulnerability': return 'bg-yellow-100 text-yellow-800'
      case 'phishing': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Globe className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{source.title}</h3>
            <p className="text-sm text-gray-500 truncate">{source.url}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ml-4 ${getStatusColor(source.isActive)}`}>
          {getStatusIcon(source.isActive)}
          <span className="text-sm font-medium">
            {source.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 line-clamp-2">{source.description}</p>
      </div>

      {/* Metadata */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Type</span>
          <span className="font-medium capitalize">{source.type}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last Checked
          </span>
          <span className="font-medium">{isClient ? lastCheckedText : 'Loading...'}</span>
        </div>
      </div>

      {/* Threat Categories */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-700">Threat Categories</h4>
        <div className="flex flex-wrap gap-2">
          {source.threatCategories.map((category) => (
            <Badge 
              key={category} 
              className={`text-xs border-0 ${getCategoryColor(category)}`}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggle?.(source.id)}
          className="flex items-center gap-2"
        >
          {source.isActive ? (
            <>
              <ToggleRight className="w-4 h-4" />
              Disable
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              Enable
            </>
          )}
        </Button>

        {source.isDemo && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSimulateThreat?.(source.id)}
            className="flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Simulate Threat
          </Button>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => onRemove?.(source.id)}
          className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          Remove
        </Button>
      </div>

      {/* Demo Badge */}
      {source.isDemo && (
        <div className="mt-4 flex justify-center">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Demo Source
          </Badge>
        </div>
      )}
    </div>
  )
}