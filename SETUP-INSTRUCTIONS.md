# Quick Setup Instructions

## Prerequisites

1. **Install uv** (fast Python package manager):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install Google Cloud CLI** (if not already installed):
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Linux
   curl https://sdk.cloud.google.com | bash
   
   # Or follow: https://cloud.google.com/sdk/docs/install
   ```

3. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth application-default login
   ```

## Start the Platform

```bash
# Clone and start everything
git clone <repository>
cd 25-panw-rnd-hackathon

# Start all backend services
./start_all_services.sh

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
```

## Access Points

- **Frontend**: http://localhost:3000
- **Control Server**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Edge Nodes**: ports 8001-8003

## Test the System

1. Open the frontend at http://localhost:3000
2. Submit this sample blog URL:
   ```
   https://unit42.paloaltonetworks.com/apache-log4j-vulnerability-cve-2021-44228/
   ```
3. Watch the real-time threat analysis workflow!

## Troubleshooting

### Authentication Issues
```bash
# Re-authenticate if needed
gcloud auth application-default login

# Verify authentication works
gcloud auth application-default print-access-token
```

### Port Conflicts
```bash
# If ports are in use, kill existing processes
lsof -ti:8000,8001,8002,8003 | xargs kill -9
```

### Dependencies
```bash
# Reinstall dependencies if needed
cd backend && uv sync && cd ..
cd edge-backend && uv sync && cd ..
```

That's it! The system uses gcloud authentication automatically - no API keys needed.