'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ThreatAnalysis, WorkflowStep, WorkflowConnection } from '@/types/orchestration'
import { 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  X,
  ChevronRight,
  ChevronLeft
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

interface Sidebar {
  isOpen: boolean
  node: DiGraphNode | null
}

export function ThreatAnalysisDigraph({ analysis, onStepClick }: ThreatAnalysisDigraphProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<DiGraphNode[]>([])
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [sidebar, setSidebar] = useState<Sidebar>({ isOpen: false, node: null })

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
      
      // Special case: if both phase and analysis are 'completed', show as completed
      if (phaseStatus === 'completed' && currentAnalysisStatus === 'completed') {
        return 'completed'
      }
      
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
    setSidebar({ isOpen: true, node })
  }

  const handleCloseSidebar = () => {
    setSidebar({ isOpen: false, node: null })
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
    <div className="w-full h-full bg-white border border-gray-200 rounded-xl overflow-hidden flex">
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebar.isOpen ? 'mr-96' : ''}`}>
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
        </div>
      </div>

      {/* Retractable Sidebar */}
      <div className={`absolute top-0 right-0 h-full w-96 bg-gradient-to-br from-slate-50 to-blue-50 border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebar.isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {sidebar.node && (
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Node Analysis</h4>
                  <p className="text-blue-100 text-sm opacity-90">Detailed Information & Status</p>
                </div>
              </div>
              <button
                onClick={handleCloseSidebar}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Node Header Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h5 className="text-xl font-bold text-slate-900 mb-2">
                        {sidebar.node.label}
                      </h5>
                      <p className="text-slate-600 text-sm">
                        {sidebar.node.type === 'status' ? 'Analysis Phase' : 
                         sidebar.node.type === 'ioc' ? 'Implementation Step' : 
                         'Edge Node Execution'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border-2"
                        style={{
                          backgroundColor: `${getStatusColor(sidebar.node.status)}15`,
                          borderColor: `${getStatusColor(sidebar.node.status)}40`,
                          color: getStatusColor(sidebar.node.status)
                        }}
                      >
                        <div 
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: getStatusColor(sidebar.node.status) }}
                        />
                        {sidebar.node.status.toUpperCase()}
                      </span>
                      <div className="text-xs text-slate-500 mt-1 uppercase font-medium">
                        {sidebar.node.type} Node
                      </div>
                    </div>
                  </div>
                </div>

                {/* Implementation Plan Overview */}
                {analysis && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <Info className="w-4 h-4 text-white" />
                      </div>
                      <h6 className="font-bold text-slate-900">Implementation Plan Status</h6>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Analysis ID</div>
                        <div className="font-mono text-sm text-slate-900">{(analysis as any).analysisId || analysis.id || 'N/A'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Overall Status</div>
                        <div className="font-semibold text-sm text-slate-900 capitalize">{analysis.status}</div>
                      </div>
                    </div>
                    {analysis.startedAt && (
                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Timeline</div>
                          <div className="text-sm text-slate-900">
                            Started: {new Date(analysis.startedAt).toLocaleString()}
                            {analysis.completedAt && (
                              <div>Completed: {new Date(analysis.completedAt).toLocaleString()}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Implementation Steps Summary */}
                    {((analysis as any).steps || (analysis as any).workflow?.steps) && (
                      <div className="border-t border-slate-200 pt-4">
                        <div className="text-sm font-semibold text-slate-900 mb-3">Implementation Steps</div>
                        <div className="space-y-2">
                          {((analysis as any).steps ?? (analysis as any).workflow?.steps ?? []).map((step: any, index: number) => (
                            <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getStatusColor(step.status || 'pending') }}
                                />
                                <span className="text-sm text-slate-900 font-medium">
                                  {step.name || `Step ${index + 1}`}
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 capitalize">
                                {step.status || 'pending'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Type-specific details */}
                {sidebar.node.type === 'status' && sidebar.node.details && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                      <h6 className="font-bold text-slate-900">Phase Details</h6>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-sm font-semibold text-blue-900 mb-2">Current Phase</div>
                        <div className="text-blue-800 font-medium">{sidebar.node.details.phase}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-sm font-semibold text-slate-900 mb-2">Description</div>
                        <div className="text-slate-700">{sidebar.node.details.description}</div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                        <div className="text-sm font-semibold text-emerald-900 mb-2">Analysis Status</div>
                        <div className="text-emerald-800 font-medium capitalize">{sidebar.node.details.analysisStatus}</div>
                      </div>
                    </div>
                  </div>
                )}

                {sidebar.node.type === 'ioc' && sidebar.node.details && (
                  <div className="space-y-4">
                    {sidebar.node.details.analysisType ? (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-sm"></div>
                          </div>
                          <h6 className="font-bold text-slate-900">Implementation Step</h6>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <div className="text-sm font-semibold text-purple-900 mb-2">Analysis Type</div>
                            <div className="text-purple-800 font-medium">{sidebar.node.details.analysisType}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-900 mb-2">Task Description</div>
                            <div className="text-slate-700 leading-relaxed">{sidebar.node.details.description}</div>
                          </div>
                          {sidebar.node.details.priority && (
                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                              <div className="text-sm font-semibold text-amber-900 mb-2">Priority Level</div>
                              <div className="text-amber-800 font-medium capitalize">{sidebar.node.details.priority}</div>
                            </div>
                          )}
                          {/* Show assigned nodes if available */}
                          {((analysis as any).steps || (analysis as any).workflow?.steps) && sidebar.node && (
                            (() => {
                              const implStepsRaw: any[] = (analysis as any).steps ?? (analysis as any).workflow?.steps ?? []
                              const currentStep = implStepsRaw.find(s => (s.step_id ?? s.id ?? `step-${implStepsRaw.indexOf(s)}`) === sidebar.node!.id.replace(/^step-/, ''))
                              const assignedNodes = currentStep?.assigned_nodes ?? currentStep?.assignedNodes ?? []
                              
                              if (assignedNodes.length > 0) {
                                return (
                                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                                    <div className="text-sm font-semibold text-indigo-900 mb-2">Assigned Edge Nodes</div>
                                    <div className="space-y-1">
                                      {assignedNodes.map((nodeId: string, idx: number) => (
                                        <div key={idx} className="text-indigo-800 font-mono text-sm">
                                          • {nodeId}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            })()
                          )}
                        </div>
                      </div>
                    ) : sidebar.node.details.isPlaceholder ? (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center animate-pulse">
                            <div className="w-4 h-4 bg-white rounded-full"></div>
                          </div>
                          <h6 className="font-bold text-slate-900">Placeholder Node</h6>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="text-blue-800 font-medium mb-2">Awaiting IoC Extraction</div>
                          <div className="text-blue-700 text-sm">Real indicators of compromise will appear after the extraction phase completes.</div>
                        </div>
                        <div className="mt-4 bg-slate-50 rounded-lg p-4">
                          <div className="text-sm font-semibold text-slate-900 mb-2">Current Phase</div>
                          <div className="text-slate-700">{sidebar.node.details.description}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
                          </div>
                          <h6 className="font-bold text-slate-900">Indicator of Compromise</h6>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                            <div className="text-sm font-semibold text-orange-900 mb-2">Full Indicator</div>
                            <div className="bg-white rounded border p-3 font-mono text-xs text-orange-800 break-all">
                              {sidebar.node.details.fullIndicator}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="text-sm font-semibold text-slate-900 mb-2">IOC Type</div>
                              <div className="text-slate-700 font-medium">{sidebar.node.details.type}</div>
                            </div>
                            {sidebar.node.details.priority && (
                              <div className="bg-amber-50 rounded-lg p-4">
                                <div className="text-sm font-semibold text-amber-900 mb-2">Priority</div>
                                <div className="text-amber-800 font-medium capitalize">{sidebar.node.details.priority}</div>
                              </div>
                            )}
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-900 mb-2">Description</div>
                            <div className="text-slate-700 leading-relaxed">{sidebar.node.details.description}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sidebar.node.type === 'node' && sidebar.node.details && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded"></div>
                        </div>
                        <h6 className="font-bold text-slate-900">Edge Node Execution</h6>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                          <div className="text-sm font-semibold text-emerald-900 mb-2">Node Identifier</div>
                          <div className="text-emerald-800 font-mono font-medium">{sidebar.node.details.nodeId}</div>
                        </div>
                        
                        {sidebar.node.details.analysisType && (
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="text-sm font-semibold text-blue-900 mb-2">Running Analysis</div>
                            <div className="text-blue-800 font-medium">{sidebar.node.details.analysisType}</div>
                          </div>
                        )}
                        
                        {sidebar.node.details.searchingFor && (
                          <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
                            <div className="text-sm font-semibold text-violet-900 mb-2">Search Target</div>
                            <div className="bg-white rounded border p-3 font-mono text-xs text-violet-800 break-all">
                              {sidebar.node.details.searchingFor}
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                            <div className="text-sm font-semibold text-amber-900 mb-2">Evidence Found</div>
                            <div className="text-2xl font-bold text-amber-800">{sidebar.node.details.evidenceCount}</div>
                            <div className="text-xs text-amber-700 mt-1">Items discovered</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-900 mb-2">Node Status</div>
                            <div className="text-slate-700 font-medium capitalize">{sidebar.node.details.status || sidebar.node.status}</div>
                          </div>
                        </div>
                        
                        {sidebar.node.details.isDemo && (
                          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                            <div className="text-sm font-semibold text-cyan-900 mb-2">Demo Mode</div>
                            <div className="text-cyan-800 text-sm">
                              {sidebar.node.details.waitingForIoCs 
                                ? "Demo Node - Waiting for IoC extraction to complete"
                                : "Demo Node - Will show real data when analysis starts"
                              }
                            </div>
                          </div>
                        )}
                        
                        {sidebar.node.details.lastUpdated && !sidebar.node.details.isDemo && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-900 mb-2">Last Updated</div>
                            <div className="text-slate-700 text-sm">
                              {new Date(sidebar.node.details.lastUpdated).toLocaleString()}
                            </div>
                          </div>
                        )}

                        {/* Show detailed job result if available */}
                        {sidebar.node && (() => {
                          const implStepsRaw: any[] = ((analysis as any).steps ?? (analysis as any).workflow?.steps ?? [])
                          const parentStepId = sidebar.node.parentId
                          const nodeId = sidebar.node.details.nodeId
                          
                          if (parentStepId && nodeId) {
                            const parentStep = implStepsRaw.find(s => (s.step_id ?? s.id ?? `step-${implStepsRaw.indexOf(s)}`) === parentStepId)
                            const nodeResult = parentStep?.result?.[nodeId]
                            
                            if (nodeResult && Object.keys(nodeResult).length > 0) {
                              return (
                                <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                                  <div className="text-sm font-semibold text-teal-900 mb-2">Detailed Results</div>
                                  <div className="space-y-2">
                                    {nodeResult.status && (
                                      <div className="text-xs">
                                        <span className="font-medium text-teal-800">Job Status: </span>
                                        <span className="text-teal-700 capitalize">{nodeResult.status}</span>
                                      </div>
                                    )}
                                    {nodeResult.result?.status && (
                                      <div className="text-xs">
                                        <span className="font-medium text-teal-800">Result Status: </span>
                                        <span className="text-teal-700 capitalize">{nodeResult.result.status}</span>
                                      </div>
                                    )}
                                    {nodeResult.evidence && Array.isArray(nodeResult.evidence) && (
                                      <div className="text-xs">
                                        <span className="font-medium text-teal-800">Evidence Items: </span>
                                        <span className="text-teal-700">{nodeResult.evidence.length}</span>
                                      </div>
                                    )}
                                    <div className="bg-white rounded border p-2 mt-2">
                                      <div className="text-xs font-medium text-teal-900 mb-1">Raw Result Data</div>
                                      <div className="font-mono text-xs text-teal-800 max-h-24 overflow-y-auto">
                                        {JSON.stringify(nodeResult, null, 2)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                          }
                          return null
                        })()}
                      </div>
                    </div>
                    
                    {sidebar.node.details.findings && sidebar.node.details.findings.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-full"></div>
                          </div>
                          <h6 className="font-bold text-slate-900">Investigation Results</h6>
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                            {sidebar.node.details.findings.length} findings
                          </span>
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {sidebar.node.details.findings.slice(0, 10).map((finding: any, index: number) => (
                            <div key={index} className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                              <div className="text-xs font-semibold text-yellow-900 mb-2">Finding #{index + 1}</div>
                              <div className="bg-white rounded border p-3 font-mono text-xs text-yellow-800 max-h-32 overflow-y-auto">
                                {typeof finding === 'object' ? JSON.stringify(finding, null, 2) : finding}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Node Relationships */}
                {sidebar.node.parentId && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-gray-500 rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white rounded"></div>
                      </div>
                      <h6 className="font-bold text-slate-900">Node Relationships</h6>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm font-semibold text-slate-900 mb-2">Parent Node</div>
                      <div className="text-slate-700 font-mono">{sidebar.node.parentId}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Toggle Button */}
      {!sidebar.isOpen && sidebar.node && (
        <button
          onClick={() => setSidebar(prev => ({ ...prev, isOpen: true }))}
          className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 z-10 border-2 border-white"
          title="View Node Details"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}