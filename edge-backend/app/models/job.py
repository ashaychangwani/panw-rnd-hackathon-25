from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import uuid

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"

class TaskType(str, Enum):
    THREAT_HUNT_IOC = "threat_hunt_ioc"
    THREAT_HUNT_TTP = "threat_hunt_ttp"
    REGISTRY_ANALYSIS = "registry_analysis"
    FILE_SYSTEM_SCAN = "file_system_scan"
    NETWORK_MONITORING = "network_monitoring"
    LOG_ANALYSIS = "log_analysis"
    PROCESS_INSPECTION = "process_inspection"
    MEMORY_ANALYSIS = "memory_analysis"

class TaskRequest(BaseModel):
    task_type: str
    parameters: Dict[str, Any]

class TaskResponse(BaseModel):
    job_id: str
    status: str

class Job(BaseModel):
    job_id: str
    task_type: str
    parameters: Dict[str, Any]
    status: JobStatus = JobStatus.PENDING
    progress: int = 0
    result: Optional[Dict[str, Any]] = None
    evidence: Optional[List[Dict[str, Any]]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    def start(self):
        self.status = JobStatus.RUNNING
        self.started_at = datetime.utcnow()
        self.progress = 0
    
    def complete(self, result: Dict[str, Any], evidence: List[Dict[str, Any]] = None):
        self.status = JobStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.progress = 100
        self.result = result
        self.evidence = evidence or []
    
    def fail(self, error_message: str):
        self.status = JobStatus.FAILED
        self.completed_at = datetime.utcnow()
        self.error_message = error_message

class NodeInfo(BaseModel):
    node_id: str
    hostname: str
    ip_address: str
    os_type: str
    os_version: str
    location: Dict[str, str]
    capabilities: List[str]
    status: str = "online"