from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# Import AnalysisStatus from database module where it's now defined
from app.core.database import AnalysisStatus

# Pydantic Models for API
class IoC(BaseModel):
    indicator: str
    type: str  # IOC or TTP
    search_description: str
    priority: str  # high, medium, low

class ImplementationPlan(BaseModel):
    hypothesis: str
    iocs_and_ttps: List[IoC]

class WorkflowStep(BaseModel):
    step_id: str
    name: str
    description: str
    task_type: str
    assigned_nodes: List[str]
    dependencies: List[str]
    status: str
    progress: int = 0
    result: Optional[Dict[str, Any]] = None
    job_ids: Optional[Dict[str, str]] = None  # node_id -> job_id mapping

class ThreatAnalysisRequest(BaseModel):
    blog_url: str

class ThreatAnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    message: str

class ThreatAnalysisStatus(BaseModel):
    analysis_id: str
    status: str
    progress: int
    steps: List[WorkflowStep]
    implementation_plan: Optional[ImplementationPlan] = None

class NodeResult(BaseModel):
    node_id: str
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    evidence: Optional[List[Dict[str, Any]]] = None