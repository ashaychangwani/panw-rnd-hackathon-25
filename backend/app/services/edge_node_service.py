import httpx
import asyncio
import logging
from typing import Dict, List, Optional, Any
from app.models.edge_node import EdgeNodeInfo, TaskRequest, TaskResponse, JobStatus
from app.core.config import settings

logger = logging.getLogger(__name__)

class EdgeNodeService:
    def __init__(self):
        self.node_urls = settings.edge_node_urls
        self.client = httpx.AsyncClient(timeout=30.0)
        self._nodes_cache: Dict[str, EdgeNodeInfo] = {}
    
    async def discover_nodes(self) -> List[EdgeNodeInfo]:
        """Discover and register available edge nodes"""
        discovered_nodes = []
        
        for url in self.node_urls:
            try:
                response = await self.client.get(f"{url}/api/v1/health")
                if response.status_code == 200:
                    node_data = response.json()
                    node_info = EdgeNodeInfo(**node_data["node_info"])
                    discovered_nodes.append(node_info)
                    self._nodes_cache[node_info.node_id] = node_info
                    logger.info(f"Discovered edge node: {node_info.hostname}")
            except Exception as e:
                logger.warning(f"Failed to connect to edge node {url}: {str(e)}")
        
        return discovered_nodes
    
    async def submit_task(self, node_id: str, task_type: str, parameters: Dict[str, Any]) -> Optional[TaskResponse]:
        """Submit a task to a specific edge node"""
        if node_id not in self._nodes_cache:
            logger.error(f"Node {node_id} not found in cache")
            return None
        
        node_url = self._get_node_url(node_id)
        if not node_url:
            return None
        
        task_request = TaskRequest(task_type=task_type, parameters=parameters)
        
        try:
            response = await self.client.post(
                f"{node_url}/api/v1/tasks",
                json=task_request.dict()
            )
            
            if response.status_code == 200:
                return TaskResponse(**response.json())
            else:
                logger.error(f"Task submission failed for node {node_id}: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error submitting task to node {node_id}: {str(e)}")
            return None
    
    async def get_job_status(self, node_id: str, job_id: str) -> Optional[JobStatus]:
        """Get the status of a specific job on an edge node"""
        node_url = self._get_node_url(node_id)
        if not node_url:
            return None
        
        try:
            response = await self.client.get(f"{node_url}/api/v1/jobs/{job_id}/status")
            
            if response.status_code == 200:
                return JobStatus(**response.json())
            else:
                logger.error(f"Failed to get job status for {job_id} on node {node_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting job status from node {node_id}: {str(e)}")
            return None
    
    async def get_job_result(self, node_id: str, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the result of a completed job"""
        node_url = self._get_node_url(node_id)
        if not node_url:
            return None
        
        try:
            response = await self.client.get(f"{node_url}/api/v1/jobs/{job_id}/result")
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get job result for {job_id} on node {node_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting job result from node {node_id}: {str(e)}")
            return None
    
    async def distribute_task_to_all_nodes(self, task_type: str, parameters: Dict[str, Any]) -> Dict[str, str]:
        """Distribute a task to all available nodes, returns node_id -> job_id mapping"""
        job_mappings = {}
        
        # Ensure we have fresh node discovery
        await self.discover_nodes()
        
        tasks = []
        for node_id in self._nodes_cache.keys():
            tasks.append(self._submit_task_to_node(node_id, task_type, parameters))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            node_id = list(self._nodes_cache.keys())[i]
            if isinstance(result, TaskResponse):
                job_mappings[node_id] = result.job_id
                logger.info(f"Task submitted to node {node_id}, job_id: {result.job_id}")
            else:
                logger.error(f"Failed to submit task to node {node_id}: {result}")
        
        return job_mappings
    
    async def _submit_task_to_node(self, node_id: str, task_type: str, parameters: Dict[str, Any]) -> Optional[TaskResponse]:
        """Helper method for parallel task submission"""
        return await self.submit_task(node_id, task_type, parameters)
    
    async def poll_all_jobs(self, job_mappings: Dict[str, str]) -> Dict[str, JobStatus]:
        """Poll status of all jobs across nodes"""
        status_map = {}
        
        tasks = []
        for node_id, job_id in job_mappings.items():
            tasks.append(self._get_job_status_safe(node_id, job_id))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            node_id = list(job_mappings.keys())[i]
            if isinstance(result, JobStatus):
                status_map[node_id] = result
            else:
                logger.error(f"Failed to get job status from node {node_id}: {result}")
        
        return status_map
    
    async def _get_job_status_safe(self, node_id: str, job_id: str) -> Optional[JobStatus]:
        """Safe wrapper for getting job status"""
        try:
            return await self.get_job_status(node_id, job_id)
        except Exception as e:
            logger.error(f"Error getting job status: {str(e)}")
            return None
    
    def _get_node_url(self, node_id: str) -> Optional[str]:
        """Get the URL for a specific node"""
        # For simplicity, map node IDs to URLs
        # In production, this would be stored in a database
        node_url_mapping = {
            "node-01": "http://localhost:8001",
            "node-02": "http://localhost:8002", 
            "node-03": "http://localhost:8003"
        }
        
        return node_url_mapping.get(node_id)
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()