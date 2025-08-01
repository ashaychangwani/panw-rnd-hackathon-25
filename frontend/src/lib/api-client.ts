import { ThreatAnalysis, EdgeNode } from '@/types/orchestration'

// Backend API response types (snake_case from backend)
export interface EdgeNodeInfo {
  node_id: string
  hostname: string
  ip_address: string
  os_type: string
  os_version: string
  location: { country: string; city: string }
  capabilities: string[]
  status: string
}

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export interface ThreatAnalysisRequest {
  blog_url: string
}

export interface ThreatAnalysisResponse {
  analysis_id: string
  status: string
  message: string
}

export interface AnalysisStatus {
  analysis_id: string
  status: 'started' | 'running' | 'completed' | 'failed'
  progress: number
  steps: any[]
  implementation_plan?: any
  node_results?: any
  created_at?: string
  error_message?: string
}

export interface TaskRequest {
  task_type: string
  parameters: Record<string, any>
}

export interface TaskResponse {
  job_id: string
  status: string
}

export interface JobStatus {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  result?: any
}

class ApiClient {
  private baseUrl: string
  private wsBaseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL
    this.wsBaseUrl = WS_BASE_URL
  }

  // Helper method for making HTTP requests
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API request failed: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Threat Analysis APIs
  async startThreatAnalysis(blogUrl: string): Promise<ThreatAnalysisResponse> {
    return this.request<ThreatAnalysisResponse>('/threat-analysis/start', {
      method: 'POST',
      body: JSON.stringify({ blog_url: blogUrl }),
    })
  }

  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatus> {
    return this.request<AnalysisStatus>(`/threat-analysis/${analysisId}/status`)
  }

  async getAnalysisResults(analysisId: string): Promise<any> {
    return this.request(`/threat-analysis/${analysisId}/results`)
  }

  // Edge Node APIs
  async discoverEdgeNodes(): Promise<EdgeNodeInfo[]> {
    return this.request<EdgeNodeInfo[]>('/edge-nodes/discover')
  }

  async submitTaskToNode(nodeId: string, taskRequest: TaskRequest): Promise<TaskResponse> {
    return this.request<TaskResponse>(`/edge-nodes/${nodeId}/task`, {
      method: 'POST',
      body: JSON.stringify(taskRequest),
    })
  }

  async getJobStatus(nodeId: string, jobId: string): Promise<JobStatus> {
    return this.request<JobStatus>(`/edge-nodes/${nodeId}/job/${jobId}/status`)
  }

  async getJobResult(nodeId: string, jobId: string): Promise<any> {
    return this.request(`/edge-nodes/${nodeId}/job/${jobId}/result`)
  }

  // WebSocket connection for real-time updates
  connectToAnalysisStream(analysisId: string): WebSocket {
    const ws = new WebSocket(`${this.wsBaseUrl}/api/v1/threat-analysis/${analysisId}/stream`)
    return ws
  }
}

// Singleton instance
export const apiClient = new ApiClient()

// Error handling utility
export function isApiError(error: any): error is Error {
  return error instanceof Error
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  return 'An unknown error occurred'
}