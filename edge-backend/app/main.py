import os
import asyncio
from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging

from app.models.job import NodeInfo
from app.services.job_manager import JobManager
from app.services.system_monitor import SystemMonitor
from app.api import tasks

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
job_manager: JobManager = None
system_monitor: SystemMonitor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global job_manager, system_monitor
    
    # Get node configuration from environment
    node_info = {
        "node_id": os.getenv("EDGE_NODE_ID", "node-01"),
        "hostname": os.getenv("EDGE_NODE_HOSTNAME", "sec-node-01.corp.local"),
        "ip_address": os.getenv("EDGE_NODE_IP", "10.1.100.15"),
        "os_type": os.getenv("OS_TYPE", "windows"),
        "os_version": os.getenv("OS_VERSION", "Windows Server 2019"),
        "location": {
            "country": os.getenv("EDGE_NODE_LOCATION_COUNTRY", "United States"),
            "city": os.getenv("EDGE_NODE_LOCATION_CITY", "New York")
        },
        "capabilities": [
            "threat-hunting", "log-analysis", "file-scanning", 
            "network-monitoring", "process-inspection"
        ],
        "status": "online"
    }
    
    # Initialize services
    job_manager = JobManager(node_info)
    system_monitor = SystemMonitor()
    tasks.set_job_manager(job_manager)
    
    logger.info(f"Edge node {node_info['node_id']} started successfully")
    logger.info(f"Node: {node_info['hostname']} ({node_info['os_type']})")
    
    yield
    
    # Shutdown
    if job_manager:
        await job_manager.shutdown()
    logger.info("Edge node shutdown complete")

# Create FastAPI app
app = FastAPI(
    title=f"Edge Node API - {os.getenv('EDGE_NODE_ID', 'node-01')}",
    description="Edge node API for distributed threat hunting operations",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(tasks.router, prefix="/api/v1")

@app.get("/")
async def root():
    node_id = os.getenv("EDGE_NODE_ID", "node-01")
    return {
        "message": f"Edge Node {node_id} API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint that returns node information"""
    node_info = {
        "node_id": os.getenv("EDGE_NODE_ID", "node-01"),
        "hostname": os.getenv("EDGE_NODE_HOSTNAME", "sec-node-01.corp.local"),
        "ip_address": os.getenv("EDGE_NODE_IP", "10.1.100.15"),
        "os_type": os.getenv("OS_TYPE", "windows"),
        "os_version": os.getenv("OS_VERSION", "Windows Server 2019"),
        "location": {
            "country": os.getenv("EDGE_NODE_LOCATION_COUNTRY", "United States"),
            "city": os.getenv("EDGE_NODE_LOCATION_CITY", "New York")
        },
        "capabilities": [
            "threat-hunting", "log-analysis", "file-scanning", 
            "network-monitoring", "process-inspection"
        ],
        "status": "online"
    }
    
    # Get real-time resource utilization
    if system_monitor:
        try:
            resources = await system_monitor.get_all_resources()
            node_info["resources"] = resources
        except Exception as e:
            logger.error(f"Error getting resource utilization: {e}")
            # Fallback to default values if monitoring fails
            node_info["resources"] = {
                "cpu": 0.0,
                "memory": 0.0,
                "network": 0.0,
                "disk": 0.0
            }
    
    # Get current job statistics
    active_jobs = {}
    if job_manager:
        active_jobs = job_manager.get_active_jobs()
    
    return {
        "status": "healthy",
        "node_info": node_info,
        "active_jobs": len(active_jobs),
        "service_version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )