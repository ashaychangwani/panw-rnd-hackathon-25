'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ThreatAnalysis, WorkflowStep, WorkflowConnection } from '@/types/orchestration'
import { 
  FileText,
  Search,
  Zap,
  MonitorSpeaker,
  Network,
  ShieldCheck,
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader
} from 'lucide-react'

interface ThreatAnalysisDigraphProps {
  analysis: ThreatAnalysis
  onStepClick?: (step: WorkflowStep) => void
}

interface StepPosition {
  x: number
  y: number
}

export function ThreatAnalysisDigraph({ analysis, onStepClick }: ThreatAnalysisDigraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [stepPositions, setStepPositions] = useState<Record<string, StepPosition>>({})
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedStep, setSelectedStep] = useState<string | null>(null)

  // Create fixed horizontal workflow layout
  useEffect(() => {
    const steps = analysis.workflow.steps
    const positions: Record<string, StepPosition> = {}
    
    // Define workflow order
    const workflowOrder = [
      'blog-detection',
      'ioc-extraction', 
      'fleet-deployment',
      'node-scanning',
      'evidence-correlation',
      'mitigation'
    ]
    
    const stepWidth = 220
    const stepSpacing = 100
    const startX = 50
    const centerY = 200
    
    steps.forEach((step, index) => {
      const orderIndex = workflowOrder.indexOf(step.type)
      const xPos = startX + (orderIndex >= 0 ? orderIndex : index) * (stepWidth + stepSpacing)
      
      positions[step.id] = {
        x: xPos,
        y: centerY
      }
    })
    
    setStepPositions(positions)
  }, [analysis.workflow])

  const getStepStatusColor = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'pending': return '#6b7280' // gray
      case 'running': return '#3b82f6' // blue
      case 'completed': return '#10b981' // green
      case 'failed': return '#ef4444' // red
      case 'waiting': return '#f59e0b' // yellow
      default: return '#6b7280'
    }
  }

  const getStepIcon = (type: WorkflowStep['type']) => {
    switch (type) {
      case 'blog-detection': return FileText
      case 'ioc-extraction': return Search
      case 'fleet-deployment': return Zap
      case 'node-scanning': return MonitorSpeaker
      case 'evidence-correlation': return Network
      case 'mitigation': return ShieldCheck
      default: return Clock
    }
  }

  const getStepStatusIcon = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'pending': return Clock
      case 'running': return Loader
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'waiting': return AlertTriangle
      default: return Clock
    }
  }

  const handleStepClick = (step: WorkflowStep) => {
    setSelectedStep(step.id)
    onStepClick?.(step)
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.4))
  const handleResetView = () => {
    setZoom(0.8)
    setPan({ x: 0, y: 0 })
  }

  const viewBoxWidth = 1400
  const viewBoxHeight = 500

  return (
    <div className="w-full h-full bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Automated Threat Analysis</h3>
          <span className="text-sm text-gray-500">
            {analysis.workflow.steps.filter(s => s.status === 'completed').length} / {analysis.workflow.steps.length} steps completed
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[500px] overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`${pan.x} ${pan.y} ${viewBoxWidth / zoom} ${viewBoxHeight / zoom}`}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f8fafc" strokeWidth="1"/>
            </pattern>
            <marker
              id="arrow"
              markerWidth="12"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,8 L12,4 z" fill="#9ca3af"/>
            </marker>
          </defs>
          <rect x={-500} y={-500} width="2000" height="1500" fill="url(#grid)" />

          {/* Workflow connections */}
          {analysis.workflow.connections.map(connection => {
            const sourcePos = stepPositions[connection.source]
            const targetPos = stepPositions[connection.target]
            
            if (!sourcePos || !targetPos) return null
            
            const sourceStep = analysis.workflow.steps.find(s => s.id === connection.source)
            const isActive = sourceStep?.status === 'completed' || sourceStep?.status === 'running'
            
            return (
              <g key={connection.id}>
                <line
                  x1={sourcePos.x + 220} // Step width
                  y1={sourcePos.y + 60} // Half step height
                  x2={targetPos.x}
                  y2={targetPos.y + 60}
                  stroke={isActive ? '#3b82f6' : '#d1d5db'}
                  strokeWidth={isActive ? 3 : 2}
                  markerEnd="url(#arrow)"
                />
              </g>
            )
          })}

          {/* Workflow steps */}
          {analysis.workflow.steps.map(step => {
            const position = stepPositions[step.id]
            if (!position) return null
            
            const TypeIcon = getStepIcon(step.type)
            const StatusIcon = getStepStatusIcon(step.status)
            const statusColor = getStepStatusColor(step.status)
            const isSelected = selectedStep === step.id
            
            return (
              <g
                key={step.id}
                transform={`translate(${position.x}, ${position.y})`}
                className="cursor-pointer"
                onClick={() => handleStepClick(step)}
              >
                {/* Step background - Make it taller to show more info */}
                <rect
                  width="280"
                  height="140"
                  rx="12"
                  fill="white"
                  stroke={isSelected ? '#3b82f6' : '#e5e7eb'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="drop-shadow-lg"
                />
                
                {/* Status indicator bar */}
                <rect
                  width="280"
                  height="6"
                  rx="3"
                  fill={statusColor}
                />
                
                {/* Progress bar for running steps */}
                {step.status === 'running' && (
                  <rect
                    x="12"
                    y="120"
                    width={Math.max(0, (step.progress / 100) * 256)}
                    height="6"
                    rx="3"
                    fill="#3b82f6"
                  />
                )}
                
                {/* Step content */}
                <g transform="translate(16, 20)">
                  {/* Type icon */}
                  <TypeIcon 
                    className="w-6 h-6" 
                    style={{ color: statusColor }}
                  />
                  
                  {/* Status icon */}
                  <g transform="translate(164, 0)">
                    <StatusIcon 
                      className={`w-5 h-5 ${step.status === 'running' ? 'animate-spin' : ''}`}
                      style={{ color: statusColor }}
                    />
                  </g>
                  
                  {/* Step name */}
                  <text
                    x="0"
                    y="50"
                    className="text-sm font-semibold"
                    fill="#111827"
                  >
                    {step.name}
                  </text>
                  
                  {/* Step description - Enhanced with more details */}
                  <text
                    x="0"
                    y="68"
                    className="text-xs"
                    fill="#6b7280"
                  >
                    {step.description.length > 35 
                      ? `${step.description.substring(0, 35)}...` 
                      : step.description
                    }
                  </text>

                  {/* Task type and priority indicator */}
                  <text
                    x="0"
                    y="82"
                    className="text-xs font-mono"
                    fill="#059669"
                  >
                    {step.type?.replace(/_/g, ' ').toUpperCase()}
                  </text>
                  
                  {/* Node assignment info */}
                  {step.affectedNodes && step.affectedNodes.length > 0 && (
                    <text
                      x="0"
                      y="96"
                      className="text-xs"
                      fill="#7c3aed"
                    >
                      Nodes: {step.affectedNodes.length} assigned
                    </text>
                  )}
                  
                  {/* Progress text for running steps */}
                  {step.status === 'running' && (
                    <text
                      x="0"
                      y="108"
                      className="text-xs font-medium"
                      fill="#3b82f6"
                    >
                      {Math.round(step.progress)}% complete
                    </text>
                  )}
                  
                  {/* Results summary for completed steps */}
                  {step.status === 'completed' && step.results && (
                    <text
                      x="0"
                      y="108"
                      className="text-xs font-medium"
                      fill="#059669"
                    >
                      ✓ Evidence found: {step.results.findings_count || 0}
                    </text>
                  )}
                  
                  {/* All nodes indicator */}
                  {step.allNodes && (
                    <text
                      x="180"
                      y="96"
                      className="text-xs"
                      fill="#9ca3af"
                    >
                      All nodes
                    </text>
                  )}
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Selected step details */}
      {selectedStep && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {(() => {
            const step = analysis.workflow.steps.find(s => s.id === selectedStep)
            if (!step) return null
            
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{step.name}</h4>
                  <span 
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={{ 
                      backgroundColor: `${getStepStatusColor(step.status)}20`,
                      color: getStepStatusColor(step.status)
                    }}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{step.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Type: {step.type.replace('-', ' ')}</span>
                  <span>Duration: {step.estimatedDuration}s</span>
                  <span>Scope: {step.allNodes ? 'All nodes' : `${step.affectedNodes.length} nodes`}</span>
                </div>
                {step.results && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                    Results: {JSON.stringify(step.results, null, 2).substring(0, 100)}...
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}