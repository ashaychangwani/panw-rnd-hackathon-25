from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any
import asyncio
import json
import logging
from datetime import datetime

from app.core.database import get_storage, SimpleStorage
from app.models.threat_analysis import ThreatAnalysisRequest, ThreatAnalysisResponse, ThreatAnalysisStatus
from app.services.orchestration_service import OrchestrationService

logger = logging.getLogger(__name__)
router = APIRouter()

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime objects"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

@router.post("/start", response_model=ThreatAnalysisResponse)
async def start_threat_analysis(
    request: ThreatAnalysisRequest,
    storage: SimpleStorage = Depends(get_storage)
):
    """
    Start a new threat analysis for the given blog URL.
    """
    try:
        orchestration_service = OrchestrationService(storage, enable_cleanup=True)
        analysis_id = await orchestration_service.start_threat_analysis(request.blog_url)
        
        return ThreatAnalysisResponse(
            analysis_id=analysis_id,
            status="started",
            message=f"Threat analysis started for {request.blog_url}"
        )
    except Exception as e:
        logger.error(f"Error starting threat analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{analysis_id}/status")
async def get_analysis_status(
    analysis_id: str,
    storage: SimpleStorage = Depends(get_storage)
):
    """
    Get the current status of a threat analysis (legacy format).
    """
    try:
        # Use static method for fast status checking without creating full service instance
        status = OrchestrationService.get_analysis_status_static(storage, analysis_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting analysis status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{analysis_id}/status/structured")
async def get_structured_analysis_status(
    analysis_id: str,
    storage: SimpleStorage = Depends(get_storage)
):
    """
    Get the current status of a threat analysis with improved structure.
    """
    try:
        # Use new structured method for better organized response
        status = OrchestrationService.get_structured_analysis_status(storage, analysis_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting structured analysis status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active")
async def get_active_analyses(storage: SimpleStorage = Depends(get_storage)):
    """
    Get information about currently active analyses.
    """
    try:
        orchestration_service = OrchestrationService(storage, enable_cleanup=False)
        active_count = orchestration_service.get_active_analyses_count()
        active_info = orchestration_service.get_active_analyses_info()
        
        return {
            "active_count": active_count,
            "analyses": active_info
        }
    except Exception as e:
        logger.error(f"Error getting active analyses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{analysis_id}")
async def cancel_analysis(
    analysis_id: str,
    storage: SimpleStorage = Depends(get_storage)
):
    """
    Cancel a running analysis.
    """
    try:
        orchestration_service = OrchestrationService(storage, enable_cleanup=False)
        cancelled = await orchestration_service.cancel_analysis(analysis_id)
        
        if cancelled:
            return {"message": f"Analysis {analysis_id} cancelled successfully"}
        else:
            raise HTTPException(status_code=404, detail="Analysis not found or already completed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{analysis_id}/results")
async def get_analysis_results(
    analysis_id: str,
    storage: SimpleStorage = Depends(get_storage)
):
    """
    Get the complete results of a threat analysis with structured format.
    """
    try:
        # Use new structured method for better organized response
        status = OrchestrationService.get_structured_analysis_status(storage, analysis_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        if status["status"] not in ["completed", "failed"]:
            raise HTTPException(status_code=400, detail="Analysis not yet completed")
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting analysis results: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/{analysis_id}/stream")
async def websocket_analysis_stream(websocket: WebSocket, analysis_id: str):
    """
    WebSocket endpoint for real-time analysis updates.
    """
    await websocket.accept()
    active_connections[analysis_id] = websocket
    
    try:
        # Send initial status
        storage = get_storage()
        orchestration_service = OrchestrationService(storage)
        
        while True:
            try:
                # Get current status
                status = orchestration_service.get_analysis_status(analysis_id)
                
                if status:
                    await websocket.send_text(json.dumps({
                        "type": "status_update",
                        "data": status
                    }, cls=DateTimeEncoder))
                    
                    # If analysis is completed or failed, stop streaming
                    if status["status"] in ["completed", "failed"]:
                        break
                
                # Wait before next update
                await asyncio.sleep(2)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in WebSocket stream: {str(e)}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": str(e)
                }, cls=DateTimeEncoder))
                break
    
    except WebSocketDisconnect:
        pass
    finally:
        if analysis_id in active_connections:
            del active_connections[analysis_id]

async def notify_analysis_update(analysis_id: str, update_data: Dict[str, Any]):
    """
    Send updates to connected WebSocket clients.
    """
    if analysis_id in active_connections:
        websocket = active_connections[analysis_id]
        try:
            await websocket.send_text(json.dumps({
                "type": "live_update",
                "data": update_data
            }, cls=DateTimeEncoder))
        except Exception as e:
            logger.error(f"Error sending WebSocket update: {str(e)}")
            # Remove failed connection
            if analysis_id in active_connections:
                del active_connections[analysis_id]