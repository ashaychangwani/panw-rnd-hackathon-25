'use client'

import { useState, useEffect } from 'react'
import { ThreatCampaign, CampaignStatus } from '@/types/orchestration'
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Target,
  Activity,
  Calendar,
  User
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface CampaignCardProps {
  campaign: ThreatCampaign
  onCampaignClick?: (campaign: ThreatCampaign) => void
  onStatusToggle?: (campaignId: string) => void
}

export function CampaignCard({ campaign, onCampaignClick, onStatusToggle }: CampaignCardProps) {
  const [isClient, setIsClient] = useState(false)
  const [durationText, setDurationText] = useState('Loading...')

  useEffect(() => {
    setIsClient(true)
    
    const updateDuration = () => {
      if (!campaign.startedAt) {
        setDurationText('')
        return
      }
      
      const end = campaign.completedAt || new Date()
      const duration = end.getTime() - campaign.startedAt.getTime()
      const minutes = Math.floor(duration / 60000)
      const seconds = Math.floor((duration % 60000) / 1000)
      
      if (minutes > 0) {
        setDurationText(`${minutes}m ${seconds}s`)
      } else {
        setDurationText(`${seconds}s`)
      }
    }
    
    // Initial update
    updateDuration()
    
    // Update every 10 seconds for running campaigns
    let interval: NodeJS.Timeout | null = null
    if (campaign.status === 'running') {
      interval = setInterval(updateDuration, 10000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [campaign.startedAt, campaign.completedAt, campaign.status])
  const getStatusColor = (status: CampaignStatus) => {
    switch (status) {
      case 'planning': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'deploying': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'running': return 'bg-green-100 text-green-800 border-green-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'failed': return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: CampaignStatus) => {
    switch (status) {
      case 'planning': return <Clock className="w-4 h-4" />
      case 'deploying': return <Play className="w-4 h-4" />
      case 'running': return <Activity className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'cancelled': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateProgress = () => {
    const totalNodes = campaign.executionPlan.nodes.length
    const completedNodes = campaign.executionPlan.nodes.filter(n => n.status === 'completed').length
    return totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }



  const progress = calculateProgress()

  return (
    <div 
      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onCampaignClick?.(campaign)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{campaign.description}</p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ml-4 ${getStatusColor(campaign.status)}`}>
          {getStatusIcon(campaign.status)}
          <span className="text-sm font-medium capitalize">{campaign.status}</span>
        </div>
      </div>

      {/* Progress Bar for running campaigns */}
      {campaign.status === 'running' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Execution Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Campaign Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Target className="w-3 h-3" />
            Target Nodes
          </span>
          <span className="font-medium">{campaign.targetNodes.length}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Execution Steps
          </span>
          <span className="font-medium">{campaign.executionPlan.nodes.length}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Created
          </span>
          <span className="font-medium">{formatDate(campaign.createdAt)}</span>
        </div>

        {campaign.startedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {campaign.status === 'running' ? 'Running for' : 'Duration'}
            </span>
            <span className="font-medium">{isClient ? durationText : 'Loading...'}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <User className="w-3 h-3" />
            Created by
          </span>
          <span className="font-medium">{campaign.createdBy}</span>
        </div>
      </div>

      {/* Priority and Threat Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Priority</span>
          <Badge className={`${getPriorityColor(campaign.priority)} border-0 text-xs`}>
            {campaign.priority.toUpperCase()}
          </Badge>
        </div>
        
        {campaign.threatCategories.length > 0 && (
          <div>
            <span className="text-sm text-gray-500 block mb-2">Threat Categories</span>
            <div className="flex flex-wrap gap-1">
              {campaign.threatCategories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Findings indicator for completed campaigns */}
      {campaign.status === 'completed' && campaign.findings && campaign.findings.length > 0 && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {campaign.findings.length} findings detected
            </span>
          </div>
        </div>
      )}
    </div>
  )
}