"""
Simple in-memory storage for hackathon project.
Much simpler than SQLAlchemy for demo purposes.
"""
import uuid
from typing import Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass, field, asdict
from enum import Enum
import json

class AnalysisStatus(str, Enum):
    STARTED = "started"
    ANALYZING = "analyzing"
    EXTRACTING_IOCS = "extracting_iocs"
    PLANNING = "planning"
    DISTRIBUTING = "distributing"
    SCANNING = "scanning"
    GENERATING_REPORT = "generating_report"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ThreatAnalysis:
    id: str
    blog_url: str
    status: AnalysisStatus = AnalysisStatus.STARTED
    blog_content: Optional[str] = None
    implementation_plan: Optional[Dict[str, Any]] = None
    workflow_steps: Optional[list] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    final_report: Optional[Dict[str, Any]] = None

class SimpleStorage:
    """Simple in-memory storage for threat analyses"""
    
    def __init__(self):
        self.analyses: Dict[str, ThreatAnalysis] = {}
    
    def create_analysis(self, blog_url: str) -> str:
        """Create a new threat analysis"""
        analysis_id = str(uuid.uuid4())
        analysis = ThreatAnalysis(id=analysis_id, blog_url=blog_url)
        self.analyses[analysis_id] = analysis
        return analysis_id
    
    def get_analysis(self, analysis_id: str) -> Optional[ThreatAnalysis]:
        """Get an analysis by ID"""
        return self.analyses.get(analysis_id)
    
    def update_analysis(self, analysis_id: str, **kwargs) -> bool:
        """Update an analysis"""
        if analysis_id not in self.analyses:
            return False
        
        analysis = self.analyses[analysis_id]
        for key, value in kwargs.items():
            has_attr = hasattr(analysis, key)
            if not has_attr:
                print(f"WARNING: Analysis object does not have attribute '{key}'. Available attributes: {[attr for attr in dir(analysis) if not attr.startswith('_')]}")
            if has_attr:
                # Additional debug logging for final_report
                if key == 'final_report':
                    print(f"DEBUG: Setting final_report. Value type: {type(value)}, Value is None: {value is None}")
                    if value and isinstance(value, dict):
                        print(f"DEBUG: Final report keys: {list(value.keys())}")
                setattr(analysis, key, value)
            else:
                print(f"ERROR: Skipping update of non-existent attribute '{key}' on analysis {analysis_id}")
        
        analysis.updated_at = datetime.utcnow()
        return True
    
    def list_analyses(self) -> Dict[str, ThreatAnalysis]:
        """List all analyses"""
        return self.analyses.copy()
    
    def delete_analysis(self, analysis_id: str) -> bool:
        """Delete an analysis"""
        if analysis_id in self.analyses:
            del self.analyses[analysis_id]
            return True
        return False
    
    def to_dict(self, analysis: ThreatAnalysis) -> Dict[str, Any]:
        """Convert analysis to dictionary for JSON serialization"""
        data = asdict(analysis)
        # Convert datetime objects to ISO strings
        for key in ['created_at', 'updated_at', 'completed_at']:
            if data.get(key):
                data[key] = data[key].isoformat() if isinstance(data[key], datetime) else data[key]
        return data

# Global storage instance
storage = SimpleStorage()

def get_storage() -> SimpleStorage:
    """Get the storage instance"""
    return storage

def get_database():
    """Dependency compatibility - returns storage instead of DB session"""
    return storage

def init_database():
    """Initialize database - no-op for in-memory storage"""
    pass