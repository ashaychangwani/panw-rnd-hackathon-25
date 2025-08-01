'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ThreatAnalysis, WorkflowStep, WorkflowConnection } from '@/types/orchestration'
import { 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  X
} from 'lucide-react'

interface ThreatAnalysisDigraphProps {
  analysis: ThreatAnalysis
  onStepClick?: (step: WorkflowStep) => void
}

interface DiGraphNode {
  id: string
  type: 'status' | 'ioc' | 'node'
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  x: number
  y: number
  parentId?: string
  details?: any
}

interface Tooltip {
  x: number
  y: number
  node: DiGraphNode
}

export function ThreatAnalysisDigraph({ analysis, onStepClick }: ThreatAnalysisDigraphProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<DiGraphNode[]>([])
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  // Create hierarchical digraph layout based on backend analysis status
  useEffect(() => {
    const generatedNodes: DiGraphNode[] = []
    let currentY = 80
    const nodeSpacing = 120
    const iocSpacing = 160
    const childOffset = 200
    
    // Map backend status to our display status
    const mapStatus = (backendStatus: string) => {
      switch (backendStatus) {
        case 'started':
        case 'analyzing':
        case 'extracting_iocs':
        case 'planning':
        case 'distributing':
          return 'running' as const
        case 'scanning':
        case 'correlating':
          return 'running' as const
        case 'completed':
          return 'completed' as const
        case 'failed':
          return 'failed' as const
        default:
          return 'pending' as const
      }
    }

    // Helper to determine status progression for status nodes
    const getStatusNodeState = (phaseStatus: string, currentAnalysisStatus: string) => {
      const phaseOrder = ['started', 'analyzing', 'extracting_iocs', 'planning', 'distributing', 'scanning', 'correlating', 'completed']
      const currentPhaseIndex = phaseOrder.indexOf(phaseStatus)
      const analysisPhaseIndex = phaseOrder.indexOf(currentAnalysisStatus)
      
      if (currentPhaseIndex < analysisPhaseIndex) {
        return 'completed'
      } else if (currentPhaseIndex === analysisPhaseIndex) {
        return 'running'
      } else {
        return 'pending'
      }
    }

    // 1. Main Analysis Flow Nodes (1 → 2 → 3 → 4 → 5)
    const mainFlow = [
      { id: 'step1', label: '1', longLabel: 'Extracting IoCs', status: 'extracting_iocs' },
      { id: 'step2', label: '2', longLabel: 'Planning Hunt', status: 'planning' },
      { id: 'step3', label: '3', longLabel: 'IoC Scan', status: 'distributing' },
      { id: 'step4', label: '4', longLabel: 'Correlating Results', status: 'correlating' },
      { id: 'step5', label: '5', longLabel: 'Analysis Complete', status: 'completed' }
    ]

    mainFlow.forEach((step, index) => {
      const nodeStatus = getStatusNodeState(step.status, analysis.status as string)
      
      generatedNodes.push({
        id: step.id,
        type: 'status',
        label: step.longLabel,
        status: nodeStatus as DiGraphNode['status'],
        x: 100 + index * 200,
        y: currentY,
        details: {
          phase: step.status,
          analysisStatus: analysis.status,
          startedAt: analysis.startedAt,
          completedAt: analysis.completedAt,
          description: step.longLabel
        }
      })
    })

    currentY += 120

    // 2. Implementation Plan Steps (dynamic) – branch from "IoC Scan" (step 3)
    const implStepsRaw: any[] = (analysis as any).steps ?? (analysis as any).workflow?.steps ?? []

    // Only show steps that have actually started (status !== 'pending') or if the whole analysis is completed
    const visibleImplSteps = implStepsRaw.filter(s => (s.status && s.status !== 'pending') || analysis.status === 'completed')

    const step3X = 100 + 2 * 200 // X-coordinate of the "IoC Scan" (3rd) status node
    const childSpacing = 140

    visibleImplSteps.forEach((step, index) => {
      const offset = -((visibleImplSteps.length - 1) / 2) * childSpacing + index * childSpacing
      const xPos = step3X + offset

      // Derive node status from step data
      let stepStatus: DiGraphNode['status'] = 'pending'
      if (analysis.status === 'completed') {
        // If overall analysis is completed, all steps should be completed
        stepStatus = 'completed'
      } else if (step.status === 'completed') {
        stepStatus = 'completed'
      } else if (step.status === 'running') {
        stepStatus = 'running'
      } else if (step.status === 'failed') {
        stepStatus = 'failed'
      } else if (step.status && step.status !== 'pending') {
        // Any other non-pending status should show as running
        stepStatus = 'running'
      }

      generatedNodes.push({
        id: step.step_id ?? step.id ?? `step-${index}`,
        type: 'ioc',
        label: step.name?.length > 20 ? `${step.name.substring(0, 20)}…` : step.name ?? `Step ${index + 1}`,
        status: stepStatus,
        x: xPos,
        y: currentY,
        parentId: 'step3',
        details: {
          description: step.description,
          analysisType: step.task_type ?? step.taskType ?? 'analysis',
          priority: (step.priority ?? 'medium') as string
        }
      })

      // 3. Edge nodes (per-host execution) under each implementation step
      const parentId = step.step_id ?? step.id ?? `step-${index}`
      const assignedNodes: string[] = step.assigned_nodes ?? step.assignedNodes ?? []
      assignedNodes.forEach((nodeId: string, nodeIndex: number) => {
        // Find the matching job status in step.result, if available
        let nodeJobStatus: string | undefined
        let evidenceCount = 0
        
        // Check step.result for this nodeId
        if (step.result && step.result[nodeId]) {
          const nodeResult = step.result[nodeId]
          // Check multiple possible locations for status
          nodeJobStatus = nodeResult.status ?? nodeResult.result?.status
          // Get evidence count
          evidenceCount = nodeResult.evidence?.length ?? 0
        }

        let nodeStatus: DiGraphNode['status'] = 'pending'
        if (analysis.status === 'completed') {
          // If overall analysis is completed, all nodes should be completed
          nodeStatus = 'completed'
        } else if (nodeJobStatus === 'completed') {
          nodeStatus = 'completed'
        } else if (nodeJobStatus === 'running' || nodeJobStatus === 'scanning') {
          nodeStatus = 'running'
        } else if (nodeJobStatus === 'failed') {
          nodeStatus = 'failed'
        }

        generatedNodes.push({
          id: `${parentId}-${nodeId}`,
          type: 'node',
          label: nodeId,
          status: nodeStatus,
          x: xPos,
          y: currentY + 80 + nodeIndex * 50,
          parentId,
          details: {
            nodeId,
            status: nodeStatus,
            analysisType: step.name,
            evidenceCount: evidenceCount,
            lastUpdated: new Date(),
            findings: []
          }
        })
      })
    })

    // --- Adjust status of the step3 ("IoC Scan") node based on child step completion ---
    // Only override step 3 status if there are visible implementation steps
    const step3Node = generatedNodes.find(n => n.id === 'step3')
    if (step3Node && visibleImplSteps.length > 0) {
      const childImplStatuses = visibleImplSteps.map(s => s.status)
      if (analysis.status === 'completed' || childImplStatuses.every(s => s === 'completed')) {
        step3Node.status = 'completed'
      } else if (childImplStatuses.some(s => s === 'running')) {
        step3Node.status = 'running'
      } else if (childImplStatuses.some(s => s === 'failed')) {
        step3Node.status = 'failed'
      } else if (childImplStatuses.length > 0) {
        // Only set to pending if we have children but they haven't started yet
        step3Node.status = 'pending'
      }
      // If no children are visible yet, keep the original status from the main flow
    }

    setNodes(generatedNodes) // Update nodes state
  }, [analysis])

  const getStatusColor = (status: DiGraphNode['status']) => {
    switch (status) {
      case 'pending': return '#6b7280' // gray
      case 'running': return '#3b82f6' // blue  
      case 'completed': return '#10b981' // green
      case 'failed': return '#ef4444' // red
      default: return '#6b7280'
    }
  }

  const getNodeSize = (type: DiGraphNode['type'], nodeId?: string) => {
    switch (type) {
      case 'status': return 30 // Main flow nodes (1, 2, 3, 4, 5)
      case 'ioc': return 25    // Implementation steps (A, B, C)
      case 'node': return 18   // Edge nodes
      default: return 20
    }
  }

  const handleNodeClick = (event: React.MouseEvent, node: DiGraphNode) => {
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (svgRect) {
      setTooltip({
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top,
        node
      })
    }
  }

  const handleCloseTooltip = () => {
    setTooltip(null)
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.4))
  const handleResetView = () => {
    setZoom(0.8)
    setPan({ x: 0, y: 0 })
  }

  const viewBoxWidth = 1400
  const viewBoxHeight = 600

  return (
    <div className="w-full h-full bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Threat Analysis Flow</h3>
          <span className="text-sm text-gray-500">
            {nodes.filter(n => n.status === 'completed').length} / {nodes.length} nodes done
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
      <div className="relative w-full h-[600px] overflow-hidden">
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

          {/* Flow arrows between main sequence steps (1 → 2 → 3 → 4 → 5) */}
          {nodes.filter(n => n.type === 'status').slice(0, -1).map((statusNode, index) => {
            const nextNode = nodes.filter(n => n.type === 'status')[index + 1]
            if (!nextNode) return null
            
            return (
              <line
                key={`flow-${statusNode.id}-${nextNode.id}`}
                x1={statusNode.x + getNodeSize('status') + 5}
                y1={statusNode.y}
                x2={nextNode.x - getNodeSize('status') - 5}
                y2={nextNode.y}
                stroke={statusNode.status === 'completed' ? '#3b82f6' : '#d1d5db'}
                strokeWidth="3"
                markerEnd="url(#arrow)"
              />
            )
          })}

          {/* Connection lines from step 3 to implementation steps (A, B, C) */}
          {(() => {
            const step3Node = nodes.find(n => n.id === 'step3')
            const implementationNodes = nodes.filter(n => n.type === 'ioc' && n.parentId === 'step3')
            
            if (!step3Node) return null
            
            return implementationNodes.map(implNode => (
              <line
                key={`step3-${implNode.id}`}
                x1={step3Node.x}
                y1={step3Node.y + getNodeSize('status') + 5}
                x2={implNode.x}
                y2={implNode.y - getNodeSize('ioc') - 5}
                stroke={step3Node.status === 'completed' || step3Node.status === 'running' ? '#3b82f6' : '#d1d5db'}
                strokeWidth="2"
                opacity="0.8"
              />
            ))
          })()}

          {/* Dotted connection lines from implementation steps (A, B, C) to their edge nodes */}
          {nodes.filter(n => n.type === 'ioc' && n.parentId === 'step3').map(implNode => {
            const childNodes = nodes.filter(n => n.parentId === implNode.id)
            return childNodes.map(childNode => (
              <line
                key={`impl-${implNode.id}-node-${childNode.id}`}
                x1={implNode.x}
                y1={implNode.y + getNodeSize('ioc') + 5}
                x2={childNode.x}
                y2={childNode.y - getNodeSize('node') - 5}
                stroke={getStatusColor(childNode.status)}
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            ))
          })}

          {/* Render all nodes as circles */}
          {nodes.map(node => {
            const size = getNodeSize(node.type)
            const color = getStatusColor(node.status)
            
            return (
              <g
                key={node.id}
                className="cursor-pointer hover:opacity-80"
                onClick={(e) => handleNodeClick(e, node)}
              >
                {/* Circle node */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={size}
                  fill={color}
                  stroke="white"
                  strokeWidth="3"
                  className="drop-shadow-lg"
                  style={{
                    filter: node.status === 'running' ? 'brightness(1.1)' : 'none'
                  }}
                />
                
                {/* Running animation */}
                {node.status === 'running' && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={size + 6}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.5"
                    className="animate-ping"
                  />
                )}
                
                {/* Node label */}
                <text
                  x={node.x}
                  y={node.y + size + 18}
                  textAnchor="middle"
                  className="text-xs font-medium"
                  fill="#374151"
                >
                  {node.label}
                </text>
                
                {/* Type indicator */}
                <text
                  x={node.x}
                  y={node.y + size + 30}
                  textAnchor="middle"
                  className="text-xs"
                  fill="#6b7280"
                >
                  {node.type.toUpperCase()}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-10"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y - 50,
              transform: tooltip.x > viewBoxWidth / 2 ? 'translateX(-100%)' : 'none'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">{tooltip.node.label}</h4>
              <button
                onClick={handleCloseTooltip}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span
                  className="px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${getStatusColor(tooltip.node.status)}20`,
                    color: getStatusColor(tooltip.node.status)
                  }}
                >
                  {tooltip.node.status}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">Type:</span>
                <span className="text-gray-600">{tooltip.node.type}</span>
              </div>

              {/* Type-specific details */}
              {tooltip.node.type === 'status' && tooltip.node.details && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phase:</span>
                    <span className="text-gray-600">{tooltip.node.details.phase}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Analysis Status:</span>
                    <span className="text-gray-600">{tooltip.node.details.analysisStatus}</span>
                  </div>
                </>
              )}

              {tooltip.node.type === 'ioc' && tooltip.node.details && (
                <>
                  {tooltip.node.details.analysisType ? (
                    <>
                      <div className="bg-purple-50 text-purple-800 text-xs px-2 py-1 rounded mb-2">
                        Implementation Step {tooltip.node.label}
                      </div>
                      <div>
                        <span className="font-medium">Analysis Type:</span>
                        <div className="text-gray-600 text-xs mt-1">
                          {tooltip.node.details.description}
                        </div>
                      </div>
                      {tooltip.node.details.priority && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Priority:</span>
                          <span className="text-gray-600 capitalize">{tooltip.node.details.priority}</span>
                        </div>
                      )}
                    </>
                  ) : tooltip.node.details.isPlaceholder ? (
                    <>
                      <div className="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded mb-2">
                        Placeholder - Real IoCs will appear after extraction
                      </div>
                      <div>
                        <span className="font-medium">Current Phase:</span>
                        <div className="text-gray-600 text-xs mt-1">
                          {tooltip.node.details.description}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="font-medium">Full Indicator:</span>
                        <div className="text-gray-600 font-mono text-xs break-all mt-1">
                          {tooltip.node.details.fullIndicator}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">IOC Type:</span>
                        <span className="text-gray-600">{tooltip.node.details.type}</span>
                      </div>
                      <div>
                        <span className="font-medium">Description:</span>
                        <div className="text-gray-600 text-xs mt-1">
                          {tooltip.node.details.description}
                        </div>
                      </div>
                      {tooltip.node.details.priority && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Priority:</span>
                          <span className="text-gray-600 capitalize">{tooltip.node.details.priority}</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {tooltip.node.type === 'node' && tooltip.node.details && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Edge Node:</span>
                    <span className="text-gray-600 font-mono">{tooltip.node.details.nodeId}</span>
                  </div>
                  
                  {tooltip.node.details.analysisType && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Running:</span>
                      <span className="text-gray-600">{tooltip.node.details.analysisType}</span>
                    </div>
                  )}
                  
                  {tooltip.node.details.searchingFor && (
                    <div>
                      <span className="font-medium">Searching For:</span>
                      <div className="text-gray-600 font-mono text-xs mt-1 break-all">
                        {tooltip.node.details.searchingFor}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Evidence Count:</span>
                    <span className="text-gray-600">{tooltip.node.details.evidenceCount}</span>
                  </div>
                  
                  {tooltip.node.details.isDemo && (
                    <div className="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded mt-2">
                      {tooltip.node.details.waitingForIoCs 
                        ? "Demo Node - Waiting for IoC extraction to complete"
                        : "Demo Node - Will show real data when analysis starts"
                      }
                    </div>
                  )}
                  
                  {tooltip.node.details.lastUpdated && !tooltip.node.details.isDemo && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Last Updated:</span>
                      <span className="text-gray-600 text-xs">
                        {new Date(tooltip.node.details.lastUpdated).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {tooltip.node.details.findings && tooltip.node.details.findings.length > 0 && (
                    <div>
                      <span className="font-medium">Recent Findings:</span>
                      <div className="text-gray-600 text-xs mt-1 max-h-20 overflow-y-auto">
                        {tooltip.node.details.findings.slice(0, 3).map((finding: any, index: number) => (
                          <div key={index} className="truncate">
                            • {JSON.stringify(finding).substring(0, 50)}...
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}