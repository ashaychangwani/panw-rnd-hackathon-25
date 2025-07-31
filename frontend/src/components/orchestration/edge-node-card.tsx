'use client'

import { useState, useEffect } from 'react'
import { EdgeNode, NodeStatus } from '@/types/orchestration'
import { 
  Monitor, 
  Cpu, 
  HardDrive, 
  Network, 
  MapPin, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface EdgeNodeCardProps {
  node: EdgeNode
  onStatusToggle?: (nodeId: string) => void
  onNodeClick?: (node: EdgeNode) => void
}

export function EdgeNodeCard({ node, onStatusToggle, onNodeClick }: EdgeNodeCardProps) {
  const [isClient, setIsClient] = useState(false)
  const [lastPingText, setLastPingText] = useState('Loading...')

  useEffect(() => {
    setIsClient(true)
    
    const updateLastPing = () => {
      const now = new Date()
      const diff = now.getTime() - node.lastPing.getTime()
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      
      if (hours > 0) {
        setLastPingText(`${hours}h ago`)
      } else if (minutes > 0) {
        setLastPingText(`${minutes}m ago`)
      } else {
        setLastPingText(`${seconds}s ago`)
      }
    }
    
    // Initial update
    updateLastPing()
    
    // Update every 30 seconds
    const interval = setInterval(updateLastPing, 30000)
    
    return () => clearInterval(interval)
  }, [node.lastPing])
  const getStatusColor = (status: NodeStatus) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800 border-green-200'
      case 'busy': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'offline': return 'bg-red-100 text-red-800 border-red-200'
      case 'error': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case 'online': return <CheckCircle className="w-4 h-4" />
      case 'busy': return <Loader className="w-4 h-4 animate-spin" />
      case 'offline': return <XCircle className="w-4 h-4" />
      case 'error': return <AlertCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const getOSIcon = (osType: string) => {
    // In a real app, you'd have proper OS icons
    return <Monitor className="w-5 h-5" />
  }

  const getResourceColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500'
    if (percentage >= 60) return 'bg-yellow-500'
    return 'bg-green-500'
  }



  return (
    <div 
      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onNodeClick?.(node)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getOSIcon(node.osType)}
          <div>
            <h3 className="font-semibold text-gray-900">{node.hostname}</h3>
            <p className="text-sm text-gray-500">{node.ipAddress}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(node.status)}`}>
          {getStatusIcon(node.status)}
          <span className="text-sm font-medium capitalize">{node.status}</span>
        </div>
      </div>

      {/* System Info */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">OS</span>
          <span className="font-medium">{node.osVersion}</span>
        </div>
        
        {node.location && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Location
            </span>
            <span className="font-medium">{node.location.city}, {node.location.country}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last Ping
          </span>
          <span className="font-medium">{isClient ? lastPingText : 'Loading...'}</span>
        </div>
      </div>

      {/* Resource Utilization */}
      <div className="space-y-3 mb-4">
        <h4 className="text-sm font-medium text-gray-700">Resource Utilization</h4>
        
        {/* CPU */}
        <div className="flex items-center gap-3">
          <Cpu className="w-4 h-4 text-gray-400" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>CPU</span>
              <span>{node.resources.cpu}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getResourceColor(node.resources.cpu)}`}
                style={{ width: `${node.resources.cpu}%` }}
              />
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="flex items-center gap-3">
          <HardDrive className="w-4 h-4 text-gray-400" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Memory</span>
              <span>{node.resources.memory}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getResourceColor(node.resources.memory)}`}
                style={{ width: `${node.resources.memory}%` }}
              />
            </div>
          </div>
        </div>

        {/* Network */}
        <div className="flex items-center gap-3">
          <Network className="w-4 h-4 text-gray-400" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Network</span>
              <span>{node.resources.network}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getResourceColor(node.resources.network)}`}
                style={{ width: `${node.resources.network}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-700">Capabilities</h4>
        <div className="flex flex-wrap gap-2">
          {node.capabilities.map((capability) => (
            <Badge key={capability} variant="secondary" className="text-xs">
              {capability.replace('-', ' ')}
            </Badge>
          ))}
        </div>
      </div>

      {/* Current Tasks */}
      {node.currentTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Current Tasks</h4>
          <div className="space-y-1">
            {node.currentTasks.map((taskId) => (
              <div key={taskId} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                Task: {taskId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}