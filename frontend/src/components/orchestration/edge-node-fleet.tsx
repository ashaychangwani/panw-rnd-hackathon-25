'use client'

import { useState } from 'react'
import { EdgeNode, NodeStatus } from '@/types/orchestration'
import { EdgeNodeCard } from './edge-node-card'
import { 
  Plus, 
  Filter, 
  Grid3X3, 
  List, 
  Search,
  MapPin,
  Monitor,
  Activity,
  AlertTriangle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface EdgeNodeFleetProps {
  nodes: EdgeNode[]
  onAddNode?: () => void
  onNodeClick?: (node: EdgeNode) => void
  onStatusToggle?: (nodeId: string) => void
}

type ViewMode = 'grid' | 'list'
type FilterStatus = 'all' | NodeStatus

export function EdgeNodeFleet({ nodes, onAddNode, onNodeClick, onStatusToggle }: EdgeNodeFleetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter and search nodes
  const filteredNodes = nodes.filter(node => {
    const matchesStatus = filterStatus === 'all' || node.status === filterStatus
    const matchesSearch = searchQuery === '' || 
      node.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.ipAddress.includes(searchQuery) ||
      node.osType.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  // Calculate fleet statistics
  const fleetStats = {
    total: nodes.length,
    online: nodes.filter(n => n.status === 'online').length,
    busy: nodes.filter(n => n.status === 'busy').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    error: nodes.filter(n => n.status === 'error').length,
    avgCpu: Math.round(nodes.reduce((sum, n) => sum + n.resources.cpu, 0) / nodes.length),
    avgMemory: Math.round(nodes.reduce((sum, n) => sum + n.resources.memory, 0) / nodes.length),
    activeTasks: nodes.reduce((sum, n) => sum + n.currentTasks.length, 0)
  }

  const getStatusBadgeColor = (status: NodeStatus) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800'
      case 'busy': return 'bg-blue-100 text-blue-800'
      case 'offline': return 'bg-red-100 text-red-800'
      case 'error': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Fleet Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Nodes</p>
              <p className="text-2xl font-semibold text-gray-900">{fleetStats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Online</p>
              <p className="text-2xl font-semibold text-gray-900">{fleetStats.online}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg CPU</p>
              <p className="text-2xl font-semibold text-gray-900">{fleetStats.avgCpu}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{fleetStats.activeTasks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left side - Title and add button */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edge Node Fleet</h2>
              <p className="text-sm text-gray-500">
                {filteredNodes.length} of {nodes.length} nodes
              </p>
            </div>
            
            <Button onClick={onAddNode} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Node
            </Button>
          </div>

          {/* Right side - Search and filters */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
                <option value="error">Error</option>
              </select>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status summary badges */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-sm text-gray-500">Status:</span>
          <Badge className={`${getStatusBadgeColor('online')} border-0`}>
            {fleetStats.online} Online
          </Badge>
          <Badge className={`${getStatusBadgeColor('busy')} border-0`}>
            {fleetStats.busy} Busy
          </Badge>
          <Badge className={`${getStatusBadgeColor('offline')} border-0`}>
            {fleetStats.offline} Offline
          </Badge>
          {fleetStats.error > 0 && (
            <Badge className={`${getStatusBadgeColor('error')} border-0`}>
              {fleetStats.error} Error
            </Badge>
          )}
        </div>
      </div>

      {/* Node List/Grid */}
      {filteredNodes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No nodes found</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first edge node to the fleet.'
            }
          </p>
          {(!searchQuery && filterStatus === 'all') && (
            <Button onClick={onAddNode} className="flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              Add First Node
            </Button>
          )}
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {filteredNodes.map((node) => (
            <EdgeNodeCard
              key={node.id}
              node={node}
              onNodeClick={onNodeClick}
              onStatusToggle={onStatusToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}