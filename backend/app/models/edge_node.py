from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class EdgeNodeInfo(BaseModel):
    node_id: str
    hostname: str
    ip_address: str
    os_type: str
    os_version: str
    location: Dict[str, str]  # country, city
    capabilities: List[str]
    status: str  # online, offline, busy

class TaskRequest(BaseModel):
    task_type: str
    parameters: Dict[str, Any]

class TaskResponse(BaseModel):
    job_id: str
    status: str

class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, running, completed, failed
    progress: int
    result: Optional[Dict[str, Any]] = None
    evidence: Optional[List[Dict[str, Any]]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None