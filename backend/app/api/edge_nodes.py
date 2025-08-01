from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_database
from app.models.edge_node import EdgeNodeInfo, TaskRequest, TaskResponse, JobStatus
from app.services.edge_node_service import EdgeNodeService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/discover", response_model=List[EdgeNodeInfo])
async def discover_edge_nodes():
    """
    Discover and return all available edge nodes.
    """
    try:
        edge_service = EdgeNodeService()
        nodes = await edge_service.discover_nodes()
        await edge_service.close()
        return nodes
    except Exception as e:
        logger.error(f"Error discovering edge nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/task", response_model=TaskResponse)
async def submit_task_to_node(
    node_id: str,
    task_request: TaskRequest
):
    """
    Submit a task to a specific edge node.
    """
    try:
        edge_service = EdgeNodeService()
        response = await edge_service.submit_task(
            node_id, 
            task_request.task_type, 
            task_request.parameters
        )
        await edge_service.close()
        
        if not response:
            raise HTTPException(status_code=404, detail=f"Node {node_id} not found or unavailable")
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting task to node {node_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/job/{job_id}/status", response_model=JobStatus)
async def get_job_status(
    node_id: str,
    job_id: str
):
    """
    Get the status of a specific job on an edge node.
    """
    try:
        edge_service = EdgeNodeService()
        status = await edge_service.get_job_status(node_id, job_id)
        await edge_service.close()
        
        if not status:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found on node {node_id}")
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/job/{job_id}/result")
async def get_job_result(
    node_id: str,
    job_id: str
):
    """
    Get the result of a completed job.
    """
    try:
        edge_service = EdgeNodeService()
        result = await edge_service.get_job_result(node_id, job_id)
        await edge_service.close()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Job {job_id} result not found on node {node_id}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job result: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))