# Threat Hunting Orchestration Platform - Backend

This document provides setup and usage instructions for the backend components of the threat hunting orchestration platform.

## Architecture Overview

The platform consists of:
- **Control Server** (`backend/`) - Central orchestration and threat analysis
- **Edge Node Simulators** (`edge-backend/`) - Simulated edge nodes for demonstration
- **Frontend** (`frontend/`) - React-based user interface

## Prerequisites

- Python 3.8+
- [uv](https://github.com/astral-sh/uv) - Fast Python package installer
- Google Cloud CLI with authentication (`gcloud auth application-default login`)
- Node.js 18+ (for frontend)

### Installing uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or via pip
pip install uv
```

## Quick Start

### 1. Setup Google AI Authentication

The backend uses Google's Gemini AI with gcloud authentication:

```bash
# Authenticate with Google Cloud (required)
gcloud auth application-default login

# Optional: Database and server configuration
export DATABASE_URL=sqlite:///./threat_hunting.db
export CORS_ORIGINS=http://localhost:3000
export HOST=0.0.0.0
export PORT=8000
```

### 2. Start All Services

Use the convenient startup script:

```bash
./start_all_services.sh
```

This will:
- Install Python dependencies
- Start the control server on port 8000
- Start 3 edge node simulators on ports 8001-8003
- Provide instructions for starting the frontend

### 3. Manual Service Startup

#### Control Server

```bash
cd backend
uv sync
uv run python start_server.py
```

#### Edge Node Simulators

```bash
cd edge-backend
uv sync

# Start multiple nodes
uv run python start_edge_node.py --node-id node-01 --port 8001
uv run python start_edge_node.py --node-id node-02 --port 8002  
uv run python start_edge_node.py --node-id node-03 --port 8003
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Service URLs

- **Control Server**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Edge Node 1**: http://localhost:8001/api/v1/health
- **Edge Node 2**: http://localhost:8002/api/v1/health
- **Edge Node 3**: http://localhost:8003/api/v1/health
- **Frontend**: http://localhost:3000

## Workflow Demonstration

### 1. Submit a Blog URL

Using the frontend or API:

```bash
curl -X POST "http://localhost:8000/api/v1/threat-analysis/start" \
  -H "Content-Type: application/json" \
  -d '{
    "blog_url": "https://unit42.paloaltonetworks.com/apache-log4j-vulnerability-cve-2021-44228/"
  }'
```

### 2. Monitor Progress

Check analysis status:

```bash
curl "http://localhost:8000/api/v1/threat-analysis/{analysis_id}/status"
```

### 3. View Results

Get complete results:

```bash
curl "http://localhost:8000/api/v1/threat-analysis/{analysis_id}/results"
```

## How It Works

### 1. Blog Analysis Flow

1. **URL Submission**: Frontend sends blog URL to control server
2. **Content Extraction**: Control server fetches and extracts blog content
3. **AI Analysis**: Gemini AI analyzes content and extracts IoCs/TTPs
4. **Plan Generation**: System creates structured implementation plan
5. **Task Distribution**: Tasks distributed to all edge nodes
6. **Execution Monitoring**: Real-time progress tracking
7. **Result Correlation**: Cross-node evidence correlation
8. **Final Report**: Comprehensive threat analysis report

### 2. Edge Node Simulation

Each edge node simulates:
- **File System Scanning**: Looking for malicious files
- **Registry Analysis**: Windows registry investigation
- **Network Monitoring**: Connection pattern analysis  
- **Log Analysis**: Security log examination
- **Process Inspection**: Running process investigation
- **Memory Analysis**: Memory artifact detection

### 3. Real-time Updates

- WebSocket connections for live progress updates
- Automatic digraph visualization updates
- Cross-node correlation and pattern detection

## Configuration

### Node Configurations

The system includes predefined node configurations:

- **Node-01**: Windows Server 2019, New York
- **Node-02**: Ubuntu 22.04 LTS, Frankfurt  
- **Node-03**: macOS 14.1, Tokyo

### Customization

Modify `edge-backend/start_edge_node.py` to add custom node configurations or use command-line arguments:

```bash
uv run python start_edge_node.py \
  --node-id custom-01 \
  --port 8004 \
  --hostname "custom-node.domain.com" \
  --os-type linux \
  --location "Seattle, USA"
```

## API Reference

### Control Server Endpoints

- `POST /api/v1/threat-analysis/start` - Start new analysis
- `GET /api/v1/threat-analysis/{id}/status` - Get analysis status
- `GET /api/v1/threat-analysis/{id}/results` - Get final results
- `WebSocket /ws/threat-analysis/{id}` - Real-time updates
- `GET /api/v1/edge-nodes/discover` - Discover available nodes

### Edge Node Endpoints

- `POST /api/v1/tasks` - Submit task
- `GET /api/v1/jobs/{job_id}/status` - Check job status
- `GET /api/v1/jobs/{job_id}/result` - Get job result
- `GET /api/v1/health` - Node health check

## Troubleshooting

### Common Issues

1. **Missing uv**
   ```
   uv: command not found
   ```
   Solution: Install uv using the installation instructions above

2. **Google AI Authentication**
   ```
   google.auth.exceptions.DefaultCredentialsError
   ```
   Solution: Run `gcloud auth application-default login` to authenticate with Google Cloud

3. **Port Already in Use**
   ```
   OSError: [Errno 48] Address already in use
   ```
   Solution: Stop existing services or use different ports

3. **Connection Refused**
   ```
   httpx.ConnectError: Connection refused
   ```
   Solution: Ensure edge nodes are running before control server

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
uv run python start_server.py
```

### Health Checks

Verify all services are running:

```bash
# Control server
curl http://localhost:8000/health

# Edge nodes
curl http://localhost:8001/api/v1/health
curl http://localhost:8002/api/v1/health  
curl http://localhost:8003/api/v1/health
```

## Development

### Adding New Task Types

1. Define task type in `edge-backend/app/models/job.py`
2. Implement simulation in `edge-backend/app/services/simulation_service.py`
3. Add corresponding workflow step in control server

### Database Schema

The control server uses SQLite by default. To use PostgreSQL:

```bash
export DATABASE_URL=postgresql://user:password@localhost/threat_hunting
uv add psycopg2-binary
```

### Testing

Run the test suite:

```bash
cd backend
uv run pytest tests/

cd ../edge-backend  
uv run pytest tests/
```

## Production Deployment

For production deployment:

1. Use proper database (PostgreSQL)
2. Set up SSL/TLS certificates
3. Configure proper logging
4. Use production WSGI server (gunicorn)
5. Set up monitoring and alerting

```bash
# Production example
gunicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker
```

## Security Considerations

- API key rotation and secure storage
- Input validation and sanitization  
- Rate limiting on AI API calls
- Network segmentation for edge nodes
- Audit logging and monitoring
- Secure WebSocket connections

## Performance Tuning

- Adjust worker processes based on CPU cores
- Configure database connection pooling
- Implement Redis caching for frequent queries
- Use async/await for I/O operations
- Monitor memory usage and optimize as needed

## Support

For issues and questions:
- Check the troubleshooting section
- Review API documentation at `/docs`
- Monitor logs for error details
- Test individual components in isolation