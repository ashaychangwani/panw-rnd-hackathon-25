from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

Base = declarative_base()

class AnalysisStatus(str, Enum):
    STARTED = "started"
    ANALYZING = "analyzing"
    EXTRACTING_IOCS = "extracting_iocs"
    PLANNING = "planning"
    DISTRIBUTING = "distributing"
    SCANNING = "scanning"
    CORRELATING = "correlating"
    COMPLETED = "completed"
    FAILED = "failed"

class ThreatAnalysisDB(Base):
    __tablename__ = "threat_analyses"
    
    id = Column(String, primary_key=True)
    blog_url = Column(String, nullable=False)
    blog_content = Column(Text)
    status = Column(String, default=AnalysisStatus.STARTED)
    implementation_plan = Column(JSON)
    workflow_steps = Column(JSON)
    node_results = Column(JSON)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime)
    error_message = Column(Text)

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