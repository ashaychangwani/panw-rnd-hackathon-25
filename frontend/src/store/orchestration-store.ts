import { create } from 'zustand'
import { 
  EdgeNode, 
  ThreatAnalysis, 
  WorkflowStep, 
  WorkflowConnection, 
  IntelligenceSource, 
  SystemMetrics,
  NodeStatus,
  AnalysisStatus,
  ExecutionNode,
  ThreatCampaign,
  ThreatCategory
} from '@/types/orchestration'
import { generateId } from '@/lib/utils'

interface OrchestrationStore {
  // State
  edgeNodes: EdgeNode[]
  threatAnalyses: ThreatAnalysis[]
  campaigns: ThreatCampaign[]
  intelligenceSources: IntelligenceSource[]
  systemMetrics: SystemMetrics
  
  // Actions
  // Edge Node Management
  addEdgeNode: (node: Omit<EdgeNode, 'id' | 'connectedAt' | 'lastPing'>) => void
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void
  updateNodeResources: (nodeId: string, resources: Partial<EdgeNode['resources']>) => void
  removeEdgeNode: (nodeId: string) => void
  
  // Threat Analysis Management
  startThreatAnalysis: (sourceUrl: string, sourceName: string, threatTitle: string) => void
  updateAnalysisStatus: (analysisId: string, status: AnalysisStatus) => void
  updateWorkflowStep: (analysisId: string, stepId: string, updates: Partial<WorkflowStep>) => void
  completeAnalysis: (analysisId: string, success: boolean) => void
  
  // Campaign Management
  createCampaign: (name: string, description: string, triggerData: any) => void
  updateCampaignStatus: (campaignId: string, status: ThreatCampaign['status']) => void
  
  // Intelligence Sources
  addIntelligenceSource: (url: string, title: string, description: string, categories?: ThreatCategory[]) => void
  removeIntelligenceSource: (sourceId: string) => void
  toggleIntelligenceSource: (sourceId: string) => void
  simulateNewThreat: (sourceId: string) => void
  
  // System Operations
  refreshSystemMetrics: () => void
  simulateWorkflowProgress: (analysisId: string) => void
}

// Demo edge nodes
const DEMO_EDGE_NODES: Omit<EdgeNode, 'id' | 'connectedAt' | 'lastPing'>[] = [
  {
    hostname: 'sec-node-01.corp.local',
    ipAddress: '10.1.100.15',
    status: 'online',
    capabilities: ['windows-analysis', 'registry-analysis', 'log-analysis', 'file-analysis'],
    osType: 'windows',
    osVersion: 'Windows Server 2019',
    location: { country: 'United States', city: 'New York' },
    resources: { cpu: 15, memory: 32, network: 8, disk: 45 },
    currentTasks: [],
    isDemo: true
  },
  {
    hostname: 'sec-node-02.corp.local', 
    ipAddress: '10.1.100.16',
    status: 'online',
    capabilities: ['linux-analysis', 'network-scanning', 'log-analysis', 'malware-analysis'],
    osType: 'linux',
    osVersion: 'Ubuntu 22.04 LTS',
    location: { country: 'Germany', city: 'Frankfurt' },
    resources: { cpu: 45, memory: 67, network: 23, disk: 78 },
    currentTasks: [],
    isDemo: true
  },
  {
    hostname: 'sec-node-03.corp.local',
    ipAddress: '10.1.100.17', 
    status: 'busy',
    capabilities: ['macos-analysis', 'memory-forensics', 'file-analysis'],
    osType: 'macos',
    osVersion: 'macOS 14.1',
    location: { country: 'Japan', city: 'Tokyo' },
    resources: { cpu: 89, memory: 91, network: 34, disk: 56 },
    currentTasks: ['exec-001', 'exec-002'],
    isDemo: true
  }
]

// Demo intelligence sources
const DEMO_INTEL_SOURCES: Omit<IntelligenceSource, 'id'>[] = [
  {
    url: 'https://unit42.paloaltonetworks.com/apache-log4j-vulnerability-cve-2021-44228/',
    title: 'Unit 42 - Palo Alto Networks',
    description: 'Advanced threat intelligence and research from Palo Alto Networks',
    type: 'blog',
    lastChecked: new Date(Date.now() - 5 * 60 * 1000),
    isActive: true,
    threatCategories: ['vulnerability', 'apt', 'malware'],
    isDemo: true
  },
  {
    url: 'https://www.mandiant.com/resources/blog/threat-intelligence-reports',
    title: 'Mandiant Threat Intelligence',
    description: 'Enterprise security threat intelligence and incident response insights',
    type: 'blog',
    lastChecked: new Date(Date.now() - 10 * 60 * 1000),
    isActive: true,
    threatCategories: ['apt', 'ransomware', 'malware'],
    isDemo: true
  },
  {
    url: 'https://www.crowdstrike.com/blog/category/threat-intel/',
    title: 'CrowdStrike Threat Intelligence',
    description: 'Global threat intelligence and endpoint protection research',
    type: 'blog',
    lastChecked: new Date(Date.now() - 15 * 60 * 1000),
    isActive: true,
    threatCategories: ['malware', 'ransomware', 'apt'],
    isDemo: true
  }
]

export const useOrchestrationStore = create<OrchestrationStore>((set, get) => ({
  edgeNodes: DEMO_EDGE_NODES.map(node => ({ 
    ...node, 
    id: generateId(), 
    connectedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    lastPing: new Date(Date.now() - Math.random() * 5 * 60 * 1000)
  })),
  threatAnalyses: [],
  campaigns: [],
  intelligenceSources: DEMO_INTEL_SOURCES.map(source => ({ ...source, id: generateId() })),
  systemMetrics: {
    totalNodes: 3,
    onlineNodes: 2,
    activeSources: 3,
    activeAnalyses: 0,
    completedAnalyses: 12,
    threatsDetectedToday: 5,
    compromisedNodes: 0,
    averageResponseTime: 145,
    activeCampaigns: 0,
    completedCampaigns: 0
  },

  // Edge Node Management
  addEdgeNode: (nodeData) => {
    const newNode: EdgeNode = {
      ...nodeData,
      id: generateId(),
      connectedAt: new Date(),
      lastPing: new Date(),
      currentTasks: []
    }
    
    set(state => ({ 
      edgeNodes: [...state.edgeNodes, newNode],
      systemMetrics: {
        ...state.systemMetrics,
        totalNodes: state.systemMetrics.totalNodes + 1,
        onlineNodes: newNode.status === 'online' ? state.systemMetrics.onlineNodes + 1 : state.systemMetrics.onlineNodes
      }
    }))
  },

  updateNodeStatus: (nodeId: string, status: NodeStatus) => {
    set(state => ({
      edgeNodes: state.edgeNodes.map(node =>
        node.id === nodeId 
          ? { ...node, status, lastPing: new Date() }
          : node
      )
    }))
    
    // Update system metrics
    get().refreshSystemMetrics()
  },

  updateNodeResources: (nodeId: string, resources) => {
    set(state => ({
      edgeNodes: state.edgeNodes.map(node =>
        node.id === nodeId
          ? { ...node, resources: { ...node.resources, ...resources }, lastPing: new Date() }
          : node
      )
    }))
  },

  removeEdgeNode: (nodeId: string) => {
    set(state => ({
      edgeNodes: state.edgeNodes.filter(node => node.id !== nodeId)
    }))
    get().refreshSystemMetrics()
  },

  // Threat Analysis Management
  startThreatAnalysis: (sourceUrl: string, sourceName: string, threatTitle: string) => {
    const newAnalysis: ThreatAnalysis = {
      id: generateId(),
      threatTitle,
      sourceUrl,
      sourceName,
      status: 'detected',
      detectedAt: new Date(),
      priority: 'medium',
      threatCategories: ['general'] as ThreatCategory[],
      extractedIoCs: {
        ips: [],
        domains: [],
        hashes: [],
        patterns: []
      },
      workflow: {
        steps: [
          {
            id: generateId(),
            name: 'Blog Detection',
            description: 'Analyze threat intelligence from blog source',
            type: 'blog-detection',
            status: 'pending',
            progress: 0,
            allNodes: false,
            affectedNodes: [],
            estimatedDuration: 30
          },
          {
            id: generateId(),
            name: 'IoC Extraction',
            description: 'Extract indicators of compromise',
            type: 'ioc-extraction',
            status: 'pending',
            progress: 0,
            allNodes: false,
            affectedNodes: [],
            estimatedDuration: 60
          },
          {
            id: generateId(),
            name: 'Fleet Deployment',
            description: 'Deploy analysis tasks to edge nodes',
            type: 'fleet-deployment',
            status: 'pending',
            progress: 0,
            allNodes: true,
            affectedNodes: [],
            estimatedDuration: 45
          },
          {
            id: generateId(),
            name: 'Node Scanning',
            description: 'Scan edge nodes for threat indicators',
            type: 'node-scanning',
            status: 'pending',
            progress: 0,
            allNodes: true,
            affectedNodes: [],
            estimatedDuration: 120
          },
          {
            id: generateId(),
            name: 'Evidence Correlation',
            description: 'Correlate findings across all nodes',
            type: 'evidence-correlation',
            status: 'pending',
            progress: 0,
            allNodes: false,
            affectedNodes: [],
            estimatedDuration: 90
          }
        ],
        connections: []
      },
      nodeResults: {},
      overallThreatLevel: 'none',
      compromisedNodes: [],
      mitigationActions: [],
      isDemo: true
    }

    set(state => ({
      threatAnalyses: [...state.threatAnalyses, newAnalysis],
      systemMetrics: {
        ...state.systemMetrics,
        activeAnalyses: state.systemMetrics.activeAnalyses + 1
      }
    }))

    // Auto-start analysis after a delay
    setTimeout(() => {
      get().updateAnalysisStatus(newAnalysis.id, 'analyzing')
      get().simulateWorkflowProgress(newAnalysis.id)
    }, 1000)
  },

  // Campaign Management
  createCampaign: (name: string, description: string, triggerData: any) => {
    const availableNodes = get().edgeNodes.filter(node => node.status === 'online')
    
    // Generate a sample execution plan
    const executionNodes: ExecutionNode[] = [
      {
        id: generateId(),
        name: 'System Discovery',
        description: 'Gather system information and running processes',
        type: 'discovery',
        status: 'pending',
        progress: 0,
        assignedNodes: [availableNodes[0]?.id].filter(Boolean),
        dependencies: [],
        estimatedDuration: 30
      },
      {
        id: generateId(),
        name: 'IoC Analysis',
        description: 'Search for indicators of compromise',
        type: 'analysis',
        status: 'pending',
        progress: 0,
        assignedNodes: [availableNodes[1]?.id].filter(Boolean),
        dependencies: [],
        estimatedDuration: 120
      },
      {
        id: generateId(),
        name: 'Cross-Node Correlation',
        description: 'Correlate findings across edge nodes',
        type: 'correlation',
        status: 'pending',
        progress: 0,
        assignedNodes: [],
        dependencies: ['discovery', 'analysis'].map(() => generateId()).slice(0, 2),
        estimatedDuration: 60
      }
    ]

    const newCampaign: ThreatCampaign = {
      id: generateId(),
      name,
      description,
      status: 'planning',
      triggerSource: 'manual',
      triggerData,
      executionPlan: {
        nodes: executionNodes,
        edges: [
          {
            id: generateId(),
            source: executionNodes[0].id,
            target: executionNodes[2].id,
            type: 'dependency'
          },
          {
            id: generateId(),
            source: executionNodes[1].id,
            target: executionNodes[2].id,
            type: 'dependency'
          }
        ]
      },
      targetNodes: availableNodes.map(node => node.id),
      createdAt: new Date(),
      createdBy: 'demo-user',
      priority: 'medium',
      threatCategories: ['general'],
      isDemo: true
    }

    set(state => ({ 
      campaigns: [...state.campaigns, newCampaign],
      systemMetrics: {
        ...state.systemMetrics,
        activeCampaigns: state.systemMetrics.activeCampaigns + 1
      }
    }))

    // Auto-start the campaign after a delay
    setTimeout(() => {
      get().updateCampaignStatus(newCampaign.id, 'running')
    }, 1000)
  },

  updateCampaignStatus: (campaignId: string, status: ThreatCampaign['status']) => {
    set(state => ({
      campaigns: state.campaigns.map(campaign =>
        campaign.id === campaignId
          ? { 
              ...campaign, 
              status,
              startedAt: status === 'running' ? new Date() : campaign.startedAt,
              completedAt: status === 'completed' || status === 'failed' ? new Date() : campaign.completedAt
            }
          : campaign
      )
    }))

    // Update system metrics
    get().refreshSystemMetrics()
  },

  updateAnalysisStatus: (analysisId: string, status: AnalysisStatus) => {
    set(state => ({
      threatAnalyses: state.threatAnalyses.map(analysis =>
        analysis.id === analysisId
          ? { ...analysis, status, startedAt: status === 'analyzing' ? new Date() : analysis.startedAt }
          : analysis
      )
    }))
  },

  updateWorkflowStep: (analysisId: string, stepId: string, updates: Partial<WorkflowStep>) => {
    set(state => ({
      threatAnalyses: state.threatAnalyses.map(analysis =>
        analysis.id === analysisId
          ? {
              ...analysis,
              workflow: {
                ...analysis.workflow,
                steps: analysis.workflow.steps.map(step =>
                  step.id === stepId ? { ...step, ...updates } : step
                )
              }
            }
          : analysis
      )
    }))
  },

  completeAnalysis: (analysisId: string, success: boolean) => {
    set(state => ({
      threatAnalyses: state.threatAnalyses.map(analysis =>
        analysis.id === analysisId
          ? { 
              ...analysis, 
              status: success ? 'completed' : 'failed',
              completedAt: new Date()
            }
          : analysis
      ),
      systemMetrics: {
        ...state.systemMetrics,
        activeAnalyses: Math.max(0, state.systemMetrics.activeAnalyses - 1),
        completedAnalyses: state.systemMetrics.completedAnalyses + 1
      }
    }))
  },

  // Intelligence Sources
  addIntelligenceSource: (url: string, title: string, description: string, categories: ThreatCategory[] = ['general']) => {
    const newSource: IntelligenceSource = {
      id: generateId(),
      url,
      title,
      description,
      type: 'blog',
      isActive: true,
      threatCategories: categories,
      lastChecked: new Date()
    }
    
    set(state => ({ 
      intelligenceSources: [...state.intelligenceSources, newSource],
      systemMetrics: {
        ...state.systemMetrics,
        activeSources: state.systemMetrics.activeSources + 1
      }
    }))
  },

  removeIntelligenceSource: (sourceId: string) => {
    set(state => ({
      intelligenceSources: state.intelligenceSources.filter(source => source.id !== sourceId)
    }))
    get().refreshSystemMetrics()
  },

  toggleIntelligenceSource: (sourceId: string) => {
    set(state => ({
      intelligenceSources: state.intelligenceSources.map(source =>
        source.id === sourceId
          ? { ...source, isActive: !source.isActive }
          : source
      )
    }))
  },

  simulateNewThreat: (sourceId: string) => {
    const source = get().intelligenceSources.find(s => s.id === sourceId)
    if (!source || !source.isDemo) return

    // Create a new threat analysis based on the intelligence source
    get().startThreatAnalysis(
      source.url,
      source.title,
      `Threat detected from ${source.title}`
    )
  },

  // System Operations
  refreshSystemMetrics: () => {
    const { edgeNodes, threatAnalyses, campaigns, intelligenceSources } = get()
    
    set(state => ({
      systemMetrics: {
        ...state.systemMetrics,
        totalNodes: edgeNodes.length,
        onlineNodes: edgeNodes.filter(node => node.status === 'online').length,
        activeSources: intelligenceSources.filter(source => source.isActive).length,
        activeAnalyses: threatAnalyses.filter(analysis => analysis.status === 'analyzing' || analysis.status === 'scanning').length,
        compromisedNodes: edgeNodes.filter(node => node.currentTasks.length > 0).length,
        activeCampaigns: campaigns.filter(campaign => campaign.status === 'running' || campaign.status === 'planning').length,
        completedCampaigns: campaigns.filter(campaign => campaign.status === 'completed').length
      }
    }))
  },

  // Helper method for simulating workflow progress
  simulateWorkflowProgress: (analysisId: string) => {
    const analysis = get().threatAnalyses.find(a => a.id === analysisId)
    if (!analysis) return

    // Progress through workflow steps automatically
    const steps = analysis.workflow.steps
    let currentStepIndex = steps.findIndex(step => step.status === 'running')
    
    if (currentStepIndex === -1) {
      currentStepIndex = steps.findIndex(step => step.status === 'pending')
    }

    if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
      const currentStep = steps[currentStepIndex]
      
      // Start the current step if not already running
      if (currentStep.status === 'pending') {
        get().updateWorkflowStep(analysisId, currentStep.id, { 
          status: 'running', 
          startedAt: new Date() 
        })
      }

      // Simulate progress
      let progress = currentStep.progress || 0
      const progressInterval = setInterval(() => {
        progress += Math.random() * 15 + 5
        if (progress >= 100) {
          progress = 100
          get().updateWorkflowStep(analysisId, currentStep.id, { 
            status: 'completed', 
            progress,
            completedAt: new Date() 
          })
          clearInterval(progressInterval)
          
          // Start next step after delay
          if (currentStepIndex < steps.length - 1) {
            setTimeout(() => {
              get().simulateWorkflowProgress(analysisId)
            }, 1500)
          } else {
            // All steps completed
            get().completeAnalysis(analysisId, true)
          }
        } else {
          get().updateWorkflowStep(analysisId, currentStep.id, { progress })
        }
      }, 800)
    }
  }
}))

// Legacy export for compatibility during migration
export const useBlogStore = useOrchestrationStore