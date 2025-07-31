'use client'

import { useState } from 'react'
import { useOrchestrationStore } from '@/store/orchestration-store'
import { Header } from '@/components/layout/header'
import { StatsCard } from './stats-card'
import { ThreatAnalysisDigraph } from '@/components/orchestration/threat-analysis-digraph'
import { EdgeNodeFleet } from '@/components/orchestration/edge-node-fleet'
import { IntelligenceSourceCard } from '@/components/orchestration/intelligence-source-card'
import { AddIntelligenceSourceForm } from '@/components/orchestration/add-intelligence-source-form'
// import { CampaignCard } from '@/components/orchestration/campaign-card' // Removed - using inline cards instead
import { 
  Monitor,
  Activity, 
  Target,
  AlertTriangle,
  Shield,
  Plus,
  Command,
  Network,
  Globe,
  Database
} from 'lucide-react'
import { ThreatCategory } from '@/types/orchestration'
import { Button } from '@/components/ui/button'

export function ProfessionalDashboard() {
  const { 
    edgeNodes, 
    threatAnalyses, 
    intelligenceSources,
    systemMetrics,
    startThreatAnalysis,
    addIntelligenceSource,
    removeIntelligenceSource,
    toggleIntelligenceSource,
    simulateNewThreat
  } = useOrchestrationStore()

  const [activeTab, setActiveTab] = useState<'overview' | 'fleet' | 'sources' | 'analyses'>('overview')
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null)

  const activeAnalyses = threatAnalyses.filter(a => a.status === 'analyzing' || a.status === 'scanning')
  const displayAnalysis = selectedAnalysis 
    ? threatAnalyses.find(a => a.id === selectedAnalysis) 
    : activeAnalyses[0]

  const handleCreateDemoAnalysis = () => {
    startThreatAnalysis(
      'https://unit42.paloaltonetworks.com/apache-log4j-vulnerability-cve-2021-44228/',
      'Unit 42 - Palo Alto Networks',
      `Log4j Threat Detection - ${new Date().toLocaleTimeString()}`
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-3">
            <Command className="w-6 h-6 text-blue-600" />
            Threat Hunting Command Center
          </h1>
          <p className="text-text-secondary">
            Orchestrate distributed threat hunting operations across your edge node fleet
          </p>
        </div>

        {/* Fleet Status Overview - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Edge Nodes"
            value={systemMetrics.onlineNodes}
            subtitle={`${systemMetrics.totalNodes} total registered`}
            icon={Monitor}
          />
          <StatsCard
            title="Intel Sources"
            value={systemMetrics.activeSources}
            subtitle={`${intelligenceSources.length} total sources`}
            icon={Globe}
          />
          <StatsCard
            title="Active Analyses"
            value={systemMetrics.activeAnalyses}
            subtitle={`${systemMetrics.completedAnalyses} completed`}
            icon={Activity}
          />
          <StatsCard
            title="Threats Today"
            value={systemMetrics.threatsDetectedToday}
            subtitle="Auto-detected and analyzed"
            icon={AlertTriangle}
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border border-gray-200 rounded-xl p-1">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Execution Overview
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'fleet'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Edge Node Fleet
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'sources'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Intelligence Sources
            </button>
            <button
              onClick={() => setActiveTab('analyses')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'analyses'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Analysis History
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* DiGraph Visualization */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                    <Network className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">Live Threat Analysis Workflow</h2>
                    <p className="text-sm text-text-secondary">Automated threat detection and fleet-wide analysis progress</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {activeAnalyses.length > 1 && (
                    <select
                      value={selectedAnalysis || ''}
                      onChange={(e) => setSelectedAnalysis(e.target.value || null)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Latest Analysis</option>
                      {activeAnalyses.map((analysis) => (
                        <option key={analysis.id} value={analysis.id}>
                          {analysis.threatTitle}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  <Button onClick={handleCreateDemoAnalysis} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Simulate Threat
                  </Button>
                </div>
              </div>
              
              {displayAnalysis ? (
                <div className="h-[600px]">
                  <ThreatAnalysisDigraph analysis={displayAnalysis} />
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                  <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Threat Analysis</h3>
                  <p className="text-gray-500 mb-6">
                    Monitoring intelligence sources for new threats. Simulate a threat detection to see the automated analysis workflow.
                  </p>
                  <Button onClick={handleCreateDemoAnalysis} className="flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" />
                    Simulate Threat Detection
                  </Button>
                </div>
              )}
            </section>

            {/* Quick Fleet Status */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <EdgeNodeFleet 
                  nodes={edgeNodes.slice(0, 6)} 
                  onNodeClick={(node) => console.log('Node clicked:', node)}
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Analyses</h3>
                {threatAnalyses.slice(0, 3).map((analysis) => (
                  <div key={analysis.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{analysis.threatTitle}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        analysis.status === 'completed' ? 'bg-green-100 text-green-800' :
                        analysis.status === 'analyzing' ? 'bg-blue-100 text-blue-800' :
                        analysis.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {analysis.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{analysis.sourceName}</p>
                    <div className="text-xs text-gray-500">
                      Detected: {analysis.detectedAt.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'fleet' && (
          <EdgeNodeFleet 
            nodes={edgeNodes}
            onAddNode={() => console.log('Add node clicked')}
            onNodeClick={(node) => console.log('Node clicked:', node)}
          />
        )}

        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                  <Database className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Intelligence Sources</h2>
                  <p className="text-sm text-gray-500">Manage threat intelligence blogs and feeds</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {intelligenceSources.filter(s => s.isActive).length} active / {intelligenceSources.length} total
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Add Source Form */}
              <AddIntelligenceSourceForm 
                onAddSource={(url, title, description, categories) => {
                  addIntelligenceSource(url, title, description, categories)
                }}
              />
              
              {/* Existing Sources */}
              {intelligenceSources.map((source) => (
                <IntelligenceSourceCard
                  key={source.id}
                  source={source}
                  onToggle={toggleIntelligenceSource}
                  onRemove={removeIntelligenceSource}
                  onSimulateThreat={simulateNewThreat}
                />
              ))}
            </div>

            {intelligenceSources.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No intelligence sources</h3>
                <p className="text-gray-500 mb-6">
                  Add your first threat intelligence source to start monitoring for new threats.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analyses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Threat Analysis History</h2>
              <Button onClick={handleCreateDemoAnalysis} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Simulate Threat
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {threatAnalyses.map((analysis) => (
                <div key={analysis.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                     onClick={() => setSelectedAnalysis(analysis.id)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{analysis.threatTitle}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">{analysis.sourceName}</p>
                    </div>
                    
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ml-4 ${
                      analysis.status === 'completed' ? 'bg-green-100 text-green-800' :
                      analysis.status === 'analyzing' ? 'bg-blue-100 text-blue-800' :
                      analysis.status === 'scanning' ? 'bg-yellow-100 text-yellow-800' :
                      analysis.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {analysis.status}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Detected</span>
                      <span className="font-medium">{analysis.detectedAt.toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Priority</span>
                      <span className={`font-medium ${
                        analysis.priority === 'critical' ? 'text-red-600' :
                        analysis.priority === 'high' ? 'text-orange-600' :
                        analysis.priority === 'medium' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {analysis.priority.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Workflow Steps</span>
                      <span className="font-medium">
                        {analysis.workflow.steps.filter(s => s.status === 'completed').length} / {analysis.workflow.steps.length}
                      </span>
                    </div>
                  </div>

                  {analysis.compromisedNodes.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {analysis.compromisedNodes.length} nodes compromised
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {threatAnalyses.length === 0 && (
                <div className="lg:col-span-2 xl:col-span-3 bg-white border border-gray-200 rounded-xl p-12 text-center">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No threat analyses yet</h3>
                  <p className="text-gray-500 mb-6">
                    The system is monitoring intelligence sources. Simulate a threat detection to see the automated analysis workflow.
                  </p>
                  <Button onClick={handleCreateDemoAnalysis} className="flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" />
                    Simulate First Threat
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Demo Instructions */}
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-blue-900">Demo Platform Instructions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div className="space-y-2">
                  <p><strong>Edge Nodes:</strong> Three demo nodes with different capabilities and locations</p>
                  <p><strong>Threat Simulation:</strong> Click &ldquo;Simulate Threat&rdquo; to trigger automated analysis workflow</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Automated Workflow:</strong> Watch real-time threat analysis progress across all nodes</p>
                  <p><strong>Fleet Monitoring:</strong> Monitor node status, resource usage, and analysis results</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}