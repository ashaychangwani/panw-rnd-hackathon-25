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
import { apiClient, getErrorMessage, EdgeNodeInfo } from '@/lib/api-client'

interface OrchestrationStore {
  // State
  edgeNodes: EdgeNode[]
  threatAnalyses: ThreatAnalysis[]
  campaigns: ThreatCampaign[]
  intelligenceSources: IntelligenceSource[]
  systemMetrics: SystemMetrics
  isLoading: boolean
  errors: Record<string, string>
  
  // WebSocket connections
  activeConnections: Map<string, WebSocket>
  
  // Actions
  // Edge Node Management
  addEdgeNode: (node: Omit<EdgeNode, 'id' | 'connectedAt' | 'lastPing'>) => void
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void
  updateNodeResources: (nodeId: string, resources: Partial<EdgeNode['resources']>) => void
  removeEdgeNode: (nodeId: string) => void
  discoverEdgeNodes: () => Promise<void>
  
  // Threat Analysis Management
  startThreatAnalysis: (sourceUrl: string, sourceName: string, threatTitle: string) => Promise<void>
  updateAnalysisStatus: (analysisId: string, status: AnalysisStatus) => void
  updateWorkflowStep: (analysisId: string, stepId: string, updates: Partial<WorkflowStep>) => void
  completeAnalysis: (analysisId: string, success: boolean) => void
  subscribeToAnalysis: (analysisId: string) => void
  unsubscribeFromAnalysis: (analysisId: string) => void
  
  // Campaign Management
  createCampaign: (name: string, description: string, triggerData: any) => void
  updateCampaignStatus: (campaignId: string, status: ThreatCampaign['status']) => void
  
  // Intelligence Sources
  addIntelligenceSource: (url: string, title: string, description: string, categories?: ThreatCategory[]) => void
  removeIntelligenceSource: (sourceId: string) => void
  toggleIntelligenceSource: (sourceId: string) => void
  simulateNewThreat: (sourceId: string) => Promise<void>
  
  // System Operations
  refreshSystemMetrics: () => void
  setLoading: (loading: boolean) => void
  setError: (key: string, error: string) => void
  clearError: (key: string) => void
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
  edgeNodes: [], // Start with empty array and discover nodes via API
  threatAnalyses: [],
  campaigns: [],
  intelligenceSources: DEMO_INTEL_SOURCES.map(source => ({ ...source, id: generateId() })),
  systemMetrics: {
    totalNodes: 0,
    onlineNodes: 0,
    activeSources: 3,
    activeAnalyses: 0,
    completedAnalyses: 12,
    threatsDetectedToday: 5,
    compromisedNodes: 0,
    averageResponseTime: 145,
    activeCampaigns: 0,
    completedCampaigns: 0
  },
  isLoading: false,
  errors: {},
  activeConnections: new Map(),

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

  discoverEdgeNodes: async () => {
    try {
      set(state => ({ 
        ...state, 
        isLoading: true,
        errors: { ...state.errors, edgeNodes: '' }
      }))

      const backendNodes = await apiClient.discoverEdgeNodes()
      
      // Map backend EdgeNodeInfo to frontend EdgeNode format
      const discoveredNodes: EdgeNode[] = backendNodes.map(backendNode => {
        // Map backend capabilities to frontend capabilities
        const capabilityMap: Record<string, NodeCapability> = {
          'threat-hunting': 'malware-analysis',
          'log-analysis': 'log-analysis',
          'file-scanning': 'file-analysis',
          'network-monitoring': 'network-scanning',
          'process-inspection': 'memory-forensics',
          'windows-analysis': 'windows-analysis',
          'linux-analysis': 'linux-analysis',
          'macos-analysis': 'macos-analysis',
          'registry-analysis': 'registry-analysis'
        }
        
        const mappedCapabilities = backendNode.capabilities
          .map(cap => capabilityMap[cap] || cap)
          .filter(cap => ['windows-analysis', 'linux-analysis', 'macos-analysis', 'network-scanning', 'malware-analysis', 'memory-forensics', 'log-analysis', 'registry-analysis', 'file-analysis'].includes(cap)) as NodeCapability[]
        
        // Add OS-specific analysis capability
        const osSpecificCapability = `${backendNode.os_type}-analysis` as NodeCapability
        if (!mappedCapabilities.includes(osSpecificCapability)) {
          mappedCapabilities.unshift(osSpecificCapability)
        }
        
        // Add registry analysis for Windows nodes
        if (backendNode.os_type === 'windows' && !mappedCapabilities.includes('registry-analysis')) {
          mappedCapabilities.push('registry-analysis')
        }
        
        return {
          id: backendNode.node_id,
          hostname: backendNode.hostname,
          ipAddress: backendNode.ip_address,
          status: backendNode.status as NodeStatus,
          capabilities: mappedCapabilities,
          osType: backendNode.os_type as 'windows' | 'linux' | 'macos',
          osVersion: backendNode.os_version,
          location: backendNode.location ? {
            country: backendNode.location.country,
            city: backendNode.location.city
          } : undefined,
          resources: backendNode.resources ? {
            cpu: backendNode.resources.cpu,
            memory: backendNode.resources.memory,
            network: backendNode.resources.network,
            disk: backendNode.resources.disk
          } : {
            cpu: 0,
            memory: 0,
            network: 0,
            disk: 0
          },
          lastPing: new Date(),
          connectedAt: new Date(),
          currentTasks: [],
          isDemo: false
        }
      })
      
      // Replace all nodes with discovered ones (don't append, replace)
      set(state => ({
        ...state,
        edgeNodes: discoveredNodes,
        isLoading: false
      }))
      
      get().refreshSystemMetrics()
    } catch (error) {
      console.error('Error discovering edge nodes:', error)
      set(state => ({
        ...state,
        isLoading: false,
        errors: { 
          ...state.errors, 
          edgeNodes: getErrorMessage(error)
        }
      }))
    }
  },

  // Threat Analysis Management
  startThreatAnalysis: async (sourceUrl: string, sourceName: string, threatTitle: string) => {
    try {
      set(state => ({ 
        ...state, 
        isLoading: true,
        errors: { ...state.errors, threatAnalysis: '' }
      }))

      // Call the backend API to start the analysis
      const response = await apiClient.startThreatAnalysis(sourceUrl)
      
      // Create a new threat analysis with the response data
      const newAnalysis: ThreatAnalysis = {
        id: response.analysis_id,
        threatTitle,
        sourceUrl,
        sourceName,
        status: 'analyzing',
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
              name: 'Blog Analysis',
              description: 'Analyzing threat intelligence from blog source',
              type: 'blog-analysis',
              status: 'running',
              progress: 0,
              allNodes: false,
              affectedNodes: [],
              estimatedDuration: 60
            }
          ],
          connections: []
        },

        overallThreatLevel: 'none',
        compromisedNodes: [],
        mitigationActions: [],
        isDemo: false
      }

      set(state => ({
        ...state,
        threatAnalyses: [...state.threatAnalyses, newAnalysis],
        systemMetrics: {
          ...state.systemMetrics,
          activeAnalyses: state.systemMetrics.activeAnalyses + 1
        },
        isLoading: false
      }))

      // Subscribe to real-time updates
      get().subscribeToAnalysis(response.analysis_id)
      
    } catch (error) {
      console.error('Error starting threat analysis:', error)
      
      set(state => ({
        ...state,
        isLoading: false,
        errors: { 
          ...state.errors, 
          threatAnalysis: getErrorMessage(error)
        }
      }))
      
      // Still create a local analysis for demo purposes
      const demoAnalysis: ThreatAnalysis = {
        id: generateId(),
        threatTitle: `${threatTitle} (Failed)`,
        sourceUrl,
        sourceName,
        status: 'failed',
        detectedAt: new Date(),
        priority: 'medium',
        threatCategories: ['general'] as ThreatCategory[],
        extractedIoCs: { ips: [], domains: [], hashes: [], patterns: [] },
        workflow: { steps: [], connections: [] },

        overallThreatLevel: 'none',
        compromisedNodes: [],
        mitigationActions: [],
        isDemo: true
      }
      
      set(state => ({
        threatAnalyses: [...state.threatAnalyses, demoAnalysis]
      }))
    }
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
    
    // Cleanup WebSocket connection when analysis completes
    get().unsubscribeFromAnalysis(analysisId)
  },

  subscribeToAnalysis: (analysisId: string) => {
    // Don't create duplicate connections
    if (get().activeConnections.has(analysisId)) {
      return
    }

    try {
      const ws = apiClient.connectToAnalysisStream(analysisId)
      
      ws.onopen = () => {
        console.log(`WebSocket connected for analysis ${analysisId}`)
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'status_update' || data.type === 'live_update') {
            const analysisData = data.data
            
            // Update the analysis with real backend data
            set(state => ({
              threatAnalyses: state.threatAnalyses.map(analysis =>
                analysis.id === analysisId
                  ? {
                      ...analysis,
                      status: analysisData.status === 'running' ? 'analyzing' : analysisData.status,
                      workflow: {
                        ...analysis.workflow,
                        steps: analysisData.steps || analysis.workflow.steps
                      },
                      extractedIoCs: analysisData.implementation_plan?.iocs_and_ttps 
                        ? {
                            ips: analysisData.implementation_plan.iocs_and_ttps.filter((item: any) => item.type === 'IOC' && item.indicator.match(/^\d+\.\d+\.\d+\.\d+$/)).map((item: any) => item.indicator),
                            domains: analysisData.implementation_plan.iocs_and_ttps.filter((item: any) => item.type === 'IOC' && item.indicator.includes('.')).map((item: any) => item.indicator),
                            hashes: analysisData.implementation_plan.iocs_and_ttps.filter((item: any) => item.type === 'IOC' && /^[a-fA-F0-9]{32,64}$/.test(item.indicator)).map((item: any) => item.indicator),
                            patterns: analysisData.implementation_plan.iocs_and_ttps.filter((item: any) => item.type === 'TTP').map((item: any) => item.indicator)
                          }
                        : analysis.extractedIoCs,

                      completedAt: analysisData.status === 'completed' ? new Date() : analysis.completedAt
                    }
                  : analysis
              )
            }))

            // Complete analysis if backend says it's done
            if (analysisData.status === 'completed' || analysisData.status === 'failed') {
              get().completeAnalysis(analysisId, analysisData.status === 'completed')
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
      
      ws.onerror = (error) => {
        console.error(`WebSocket error for analysis ${analysisId}:`, error)
        get().setError('websocket', `Connection error for analysis ${analysisId}`)
      }
      
      ws.onclose = () => {
        console.log(`WebSocket closed for analysis ${analysisId}`)
        get().activeConnections.delete(analysisId)
      }
      
      // Store the connection
      get().activeConnections.set(analysisId, ws)
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      get().setError('websocket', getErrorMessage(error))
    }
  },

  unsubscribeFromAnalysis: (analysisId: string) => {
    const ws = get().activeConnections.get(analysisId)
    if (ws) {
      ws.close()
      get().activeConnections.delete(analysisId)
    }
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

  simulateNewThreat: async (sourceId: string) => {
    const source = get().intelligenceSources.find(s => s.id === sourceId)
    if (!source) return

    // Start real threat analysis using the source URL
    await get().startThreatAnalysis(
      source.url,
      source.title,
      `Threat Analysis - ${source.title}`
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

  // Utility functions
  setLoading: (loading: boolean) => {
    set(state => ({ ...state, isLoading: loading }))
  },

  setError: (key: string, error: string) => {
    set(state => ({
      ...state,
      errors: { ...state.errors, [key]: error }
    }))
  },

  clearError: (key: string) => {
    set(state => {
      const newErrors = { ...state.errors }
      delete newErrors[key]
      return { ...state, errors: newErrors }
    })
  }
}))

// Auto-discover edge nodes on store initialization
if (typeof window !== 'undefined') {
  // Only run in browser, not during SSR
  setTimeout(() => {
    useOrchestrationStore.getState().discoverEdgeNodes()
  }, 1000) // Small delay to ensure store is ready
}

// Legacy export for compatibility during migration
export const useBlogStore = useOrchestrationStore