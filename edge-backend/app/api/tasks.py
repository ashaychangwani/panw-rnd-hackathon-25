from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.models.job import TaskRequest, TaskResponse, Job
from app.services.job_manager import JobManager
import logging

logger = logging.getLogger(__name__)

# This will be injected by the main app
job_manager: JobManager = None

def set_job_manager(manager: JobManager):
    global job_manager
    job_manager = manager

router = APIRouter()

@router.post("/tasks", response_model=TaskResponse)
async def submit_task(task_request: TaskRequest):
    """
    Submit a new task to the edge node.
    Returns a job ID immediately and processes the task asynchronously.
    """
    try:
        if not job_manager:
            raise HTTPException(status_code=500, detail="Job manager not initialized")
        
        job_id = await job_manager.submit_job(task_request)
        
        return TaskResponse(
            job_id=job_id,
            status="accepted"
        )
    except Exception as e:
        logger.error(f"Error submitting task: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """
    Get the current status of a job.
    """
    try:
        if not job_manager:
            raise HTTPException(status_code=500, detail="Job manager not initialized")
        
        job = job_manager.get_job_status(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
        return {
            "job_id": job.job_id,
            "status": job.status,
            "progress": job.progress,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "error_message": job.error_message
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    """
    Get the result of a completed job.
    """
    try:
        if not job_manager:
            raise HTTPException(status_code=500, detail="Job manager not initialized")
        
        result = job_manager.get_job_result(job_id)
        
        if not result:
            job = job_manager.get_job_status(job_id)
            if not job:
                raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
            elif job.status != "completed":
                raise HTTPException(status_code=400, detail=f"Job {job_id} is not completed")
            else:
                raise HTTPException(status_code=404, detail=f"Result for job {job_id} not available")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job result: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs")
async def list_active_jobs():
    """
    List all active (non-completed) jobs.
    """
    try:
        if not job_manager:
            raise HTTPException(status_code=500, detail="Job manager not initialized")
        
        active_jobs = job_manager.get_active_jobs()
        
        return {
            "active_jobs": [
                {
                    "job_id": job.job_id,
                    "task_type": job.task_type,
                    "status": job.status,
                    "progress": job.progress,
                    "started_at": job.started_at
                }
                for job in active_jobs.values()
            ],
            "count": len(active_jobs)
        }
    except Exception as e:
        logger.error(f"Error listing jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))