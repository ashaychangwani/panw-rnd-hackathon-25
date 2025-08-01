import asyncio
import uuid
import logging
from typing import Dict, Optional
from datetime import datetime

from app.models.job import Job, JobStatus, TaskRequest
from app.services.simulation_service import SimulationService

logger = logging.getLogger(__name__)

class JobManager:
    """Manages job execution on the edge node"""
    
    def __init__(self, node_info: Dict):
        self.node_info = node_info
        self.jobs: Dict[str, Job] = {}
        self.simulation_service = SimulationService(node_info)
        self.active_tasks: Dict[str, asyncio.Task] = {}
    
    async def submit_job(self, task_request: TaskRequest) -> str:
        """Submit a new job and return job ID"""
        job_id = str(uuid.uuid4())
        
        job = Job(
            job_id=job_id,
            task_type=task_request.task_type,
            parameters=task_request.parameters,
            status=JobStatus.PENDING
        )
        
        self.jobs[job_id] = job
        
        # Start job execution in background
        task = asyncio.create_task(self._execute_job(job))
        self.active_tasks[job_id] = task
        
        logger.info(f"Submitted job {job_id} of type {task_request.task_type}")
        return job_id
    
    async def _execute_job(self, job: Job):
        """Execute a job in the background"""
        try:
            await self.simulation_service.execute_task(job)
            logger.info(f"Completed job {job.job_id}")
        except Exception as e:
            logger.error(f"Job {job.job_id} failed: {str(e)}")
            job.fail(str(e))
        finally:
            # Clean up task reference
            if job.job_id in self.active_tasks:
                del self.active_tasks[job.job_id]
    
    def get_job_status(self, job_id: str) -> Optional[Job]:
        """Get the current status of a job"""
        return self.jobs.get(job_id)
    
    def get_job_result(self, job_id: str) -> Optional[Dict]:
        """Get the result of a completed job"""
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        if job.status != JobStatus.COMPLETED:
            return None
        
        return {
            "job_id": job_id,
            "status": job.status,
            "result": job.result,
            "evidence": job.evidence,
            "started_at": job.started_at,
            "completed_at": job.completed_at
        }
    
    def get_active_jobs(self) -> Dict[str, Job]:
        """Get all active (non-completed) jobs"""
        return {
            job_id: job for job_id, job in self.jobs.items()
            if job.status in [JobStatus.PENDING, JobStatus.RUNNING]
        }
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Clean up old completed jobs"""
        current_time = datetime.utcnow()
        jobs_to_remove = []
        
        for job_id, job in self.jobs.items():
            if (job.status in [JobStatus.COMPLETED, JobStatus.FAILED] and 
                job.completed_at and 
                (current_time - job.completed_at).total_seconds() > max_age_hours * 3600):
                jobs_to_remove.append(job_id)
        
        for job_id in jobs_to_remove:
            del self.jobs[job_id]
            logger.info(f"Cleaned up old job {job_id}")
    
    async def shutdown(self):
        """Gracefully shutdown the job manager"""
        logger.info("Shutting down job manager...")
        
        # Cancel all active tasks
        for job_id, task in self.active_tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                logger.info(f"Cancelled job {job_id}")
        
        self.active_tasks.clear()
        logger.info("Job manager shutdown complete")