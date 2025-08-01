# Backend Specification - Threat Hunting Orchestration Platform

## Overview

The backend consists of two main components:
1. **Control Server (backend/)** - Central orchestration and analysis server
2. **Edge Node Simulator (edge-backend/)** - Simulates edge nodes for demonstration

## 1. Control Server (backend/)

### 1.1 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│   Frontend      │───▶│  Control Server  │───▶│  Edge Nodes    │
│   (Next.js)     │    │  (FastAPI)       │    │  (Simulated)   │
└─────────────────┘    └──────────────────┘    └────────────────┘
                              │
                       ┌──────────────┐
                       │   Gemini AI  │
                       │   (LLM)      │
                       └──────────────┘
```

### 1.2 Core Components

#### 1.2.1 Blog Analysis Service
- **Endpoint**: `POST /api/v1/threat-analysis/start`
- **Purpose**: Receive blog URL from frontend and initiate threat analysis
- **Flow**:
  1. Receive blog URL from frontend
  2. Fetch and extract blog content
  3. Send to Gemini AI with function calling for structured IoC extraction
  4. Generate implementation plan with step breakdown
  5. Create execution tasks for edge nodes
  6. Return analysis ID and initial status

#### 1.2.2 Gemini Integration Service
- **Purpose**: Interface with Google Gemini API for threat analysis
- **Function Calling Schema**: Ensures structured output matching the required format
- **Features**:
  - Blog content summarization
  - IoC extraction (IPs, domains, file hashes, TTPs)
  - Implementation plan generation
  - Step prioritization and dependency mapping

#### 1.2.3 Edge Node Communication Service
- **Purpose**: Manage communication with edge nodes
- **Features**:
  - Task distribution to edge nodes
  - Job ID tracking and status polling
  - Result aggregation
  - Real-time status updates

#### 1.2.4 Workflow Orchestration Service
- **Purpose**: Coordinate the overall threat analysis workflow
- **Features**:
  - Task sequencing and dependency management
  - Progress tracking across all nodes
  - Result correlation and analysis
  - Status updates to frontend via WebSocket

### 1.3 API Endpoints

#### 1.3.1 Threat Analysis Endpoints

```
POST /api/v1/threat-analysis/start
- Body: { "blog_url": "string" }
- Response: { "analysis_id": "uuid", "status": "started" }

GET /api/v1/threat-analysis/{analysis_id}/status
- Response: { "analysis_id": "uuid", "status": "running|completed|failed", "progress": 0-100, "steps": [...] }

GET /api/v1/threat-analysis/{analysis_id}/results
- Response: { "implementation_plan": {...}, "iocs": [...], "node_results": {...} }

WebSocket /ws/threat-analysis/{analysis_id}
- Real-time status updates and progress notifications
```

#### 1.3.2 Edge Node Management

```
POST /api/v1/edge-nodes/register
- Body: { "hostname": "string", "capabilities": [...], "location": {...} }
- Response: { "node_id": "uuid", "status": "registered" }

GET /api/v1/edge-nodes
- Response: { "nodes": [...] }

POST /api/v1/edge-nodes/{node_id}/task
- Body: { "task_type": "string", "parameters": {...} }
- Response: { "job_id": "uuid" }

GET /api/v1/edge-nodes/{node_id}/job/{job_id}/status
- Response: { "job_id": "uuid", "status": "pending|running|completed|failed", "result": {...} }
```

### 1.4 Data Models

#### 1.4.1 Implementation Plan Schema
```json
{
  "hypothesis": "string",
  "iocs_and_ttps": [
    {
      "indicator": "string",
      "type": "IOC|TTP",
      "search_description": "string",
      "priority": "high|medium|low"
    }
  ]
}
```

#### 1.4.2 Workflow Step Schema
```json
{
  "step_id": "uuid",
  "name": "string",
  "description": "string",
  "task_type": "string",
  "assigned_nodes": ["uuid"],
  "dependencies": ["step_id"],
  "status": "pending|running|completed|failed",
  "progress": 0-100,
  "result": {...}
}
```

### 1.5 Technology Stack

- **Framework**: FastAPI
- **Database**: SQLite with SQLAlchemy ORM
- **AI Integration**: Google Gemini API with function calling
- **WebSockets**: FastAPI WebSocket support
- **HTTP Client**: httpx for async requests
- **Task Queue**: Background tasks with asyncio
- **Validation**: Pydantic models

## 2. Edge Node Simulator (edge-backend/)

### 2.1 Purpose
Simulates multiple edge nodes for demonstration purposes, providing realistic job processing behavior.

### 2.2 Features

#### 2.2.1 Job Management
- Accepts task submissions from control server
- Returns job IDs immediately
- Processes jobs asynchronously
- Provides status polling endpoints

#### 2.2.2 Simulated Analysis
- Mimics real threat hunting operations
- Generates realistic results based on task type
- Includes random processing delays
- Simulates both positive and negative findings

### 2.3 API Endpoints

```
POST /api/v1/tasks
- Body: { "task_type": "string", "parameters": {...} }
- Response: { "job_id": "uuid", "status": "accepted" }

GET /api/v1/jobs/{job_id}/status
- Response: { "job_id": "uuid", "status": "pending|running|completed|failed", "progress": 0-100 }

GET /api/v1/jobs/{job_id}/result
- Response: { "job_id": "uuid", "result": {...}, "evidence": [...] }

GET /api/v1/health
- Response: { "status": "healthy", "node_info": {...} }
```

### 2.4 Simulated Task Types

1. **Registry Analysis** (Windows)
2. **File System Scanning** (All platforms)
3. **Network Connection Monitoring**
4. **Log Analysis**
5. **Process Inspection**
6. **Memory Analysis**

## 3. Integration Flow

### 3.1 Complete Workflow

```
1. Frontend → Control Server: POST /api/v1/threat-analysis/start
2. Control Server → Gemini AI: Analyze blog content
3. Control Server: Generate implementation plan and steps
4. Control Server → Edge Nodes: Distribute tasks
5. Edge Nodes: Process tasks asynchronously
6. Control Server: Poll edge nodes for status
7. Control Server: Aggregate results
8. Control Server → Frontend: Real-time updates via WebSocket
```

### 3.2 Real-time Updates

- WebSocket connections for live progress tracking
- Periodic polling of edge node status
- Frontend digraph updates based on step completion
- Result correlation and threat assessment

## 4. Configuration

### 4.1 Environment Variables

```bash
# Control Server
GOOGLE_API_KEY=your_gemini_api_key
DATABASE_URL=sqlite:///./threat_hunting.db
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO

# Edge Simulator
EDGE_NODE_ID=node-{1,2,3}
EDGE_NODE_PORT=8001-8003
CONTROL_SERVER_URL=http://localhost:8000
```

### 4.2 Deployment

- Control Server: `uvicorn main:app --host 0.0.0.0 --port 8000`
- Edge Simulators: Multiple instances on different ports
- Development: Docker Compose for easy setup

## 5. Security Considerations

- API key management for Gemini AI
- Input validation and sanitization
- Rate limiting for AI API calls
- Secure WebSocket connections
- Request/response logging for audit

## 6. Monitoring and Logging

- Structured logging with JSON format
- Request/response tracing
- AI API usage tracking
- Performance metrics collection
- Error tracking and alerting

This specification provides the foundation for a robust, scalable threat hunting orchestration platform that can process threat intelligence, coordinate analysis across edge nodes, and provide real-time visibility into the entire operation.