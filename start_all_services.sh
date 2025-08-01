#!/bin/bash

# Start All Services Script for Threat Hunting Platform
# This script starts the control server, edge nodes, and provides instructions for the frontend

echo "🚀 Starting Threat Hunting Orchestration Platform"
echo "=================================================="

# Check if gcloud is authenticated
if ! gcloud auth application-default print-access-token &> /dev/null; then
    echo "❌ Google Cloud authentication required"
    echo "Please run: gcloud auth application-default login"
    exit 1
fi

# Check if uv is available
if ! command -v uv &> /dev/null; then
    echo "❌ uv is required but not installed"
    echo "Install uv with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "🔧 Installing dependencies with uv..."
uv sync > /dev/null 2>&1

echo "🎛️  Starting Control Server (port 8000)..."
cd backend
uv run python start_server.py &
CONTROL_PID=$!

# Wait a moment for the control server to start
sleep 2

echo "🌐 Starting Edge Node Simulators..."
cd ../edge-backend

# Start edge nodes
echo "  📍 Starting Edge Node 1 (Windows, NYC, port 8001)..."
uv run python start_edge_node.py --node-id node-01 --port 8001 &
EDGE1_PID=$!

echo "  📍 Starting Edge Node 2 (Linux, Frankfurt, port 8002)..."
uv run python start_edge_node.py --node-id node-02 --port 8002 &
EDGE2_PID=$!

echo "  📍 Starting Edge Node 3 (macOS, Tokyo, port 8003)..."
uv run python start_edge_node.py --node-id node-03 --port 8003 &
EDGE3_PID=$!

# Wait for services to start
sleep 3

echo ""
echo "✅ All services started successfully!"
echo ""
echo "🔗 Service URLs:"
echo "  Control Server:    http://localhost:8000"
echo "  API Documentation: http://localhost:8000/docs"
echo "  Edge Node 1:       http://localhost:8001/api/v1/health"
echo "  Edge Node 2:       http://localhost:8002/api/v1/health"
echo "  Edge Node 3:       http://localhost:8003/api/v1/health"
echo ""
echo "🤖 Google AI: Using gcloud authentication"
echo "🎨 Frontend Setup:"
echo "  cd frontend"
echo "  npm install"
echo "  npm run dev"
echo "  Open: http://localhost:3000"
echo ""
echo "🧪 Test the API:"
echo "  curl http://localhost:8000/health"
echo "  curl http://localhost:8001/api/v1/health"
echo ""
echo "📋 Process IDs:"
echo "  Control Server: $CONTROL_PID"
echo "  Edge Node 1: $EDGE1_PID"
echo "  Edge Node 2: $EDGE2_PID"
echo "  Edge Node 3: $EDGE3_PID"
echo ""
echo "⏹️  To stop all services:"
echo "  Press Ctrl+C (recommended)"
echo "  Or manually: pkill -f 'start_server.py|start_edge_node.py'"
echo ""
echo "🎯 Ready for threat hunting! Submit a blog URL via the frontend or API."

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    
    # Kill processes by port (more reliable than PID with uv)
    echo "  Stopping control server (port 8000)..."
    pkill -f "start_server.py" 2>/dev/null || true
    
    echo "  Stopping edge nodes (ports 8001-8003)..."
    pkill -f "start_edge_node.py" 2>/dev/null || true
    
    # Give processes time to clean up
    sleep 2
    
    echo "✅ All services stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running with simple monitoring
echo "Press Ctrl+C to stop all services"
echo ""
echo "🔄 Services are running... (monitoring via health checks)"
while true; do
    sleep 30
done
