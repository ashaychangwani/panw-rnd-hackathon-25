import asyncio
import traceback
import uuid
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.threat_analysis import (
    ThreatAnalysisDB, AnalysisStatus, ImplementationPlan, WorkflowStep
)
from app.services.gemini_service import GeminiService
from app.services.blog_service import BlogService
from app.services.edge_node_service import EdgeNodeService

logger = logging.getLogger(__name__)

class OrchestrationService:
    def __init__(self, db: Session):
        self.db = db
        self.gemini_service = GeminiService()
        self.blog_service = BlogService()
        self.edge_service = EdgeNodeService()
        self.active_analyses: Dict[str, asyncio.Task] = {}
    
    async def start_threat_analysis(self, blog_url: str) -> str:
        """Start a new threat analysis workflow"""
        analysis_id = str(uuid.uuid4())
        
        # Create database record
        analysis = ThreatAnalysisDB(
            id=analysis_id,
            blog_url=blog_url,
            status=AnalysisStatus.STARTED
        )
        self.db.add(analysis)
        self.db.commit()
        
        # Start background processing
        task = asyncio.create_task(self._process_threat_analysis(analysis_id))
        self.active_analyses[analysis_id] = task
        
        logger.info(f"Started threat analysis {analysis_id} for URL: {blog_url}")
        return analysis_id
    
    async def _process_threat_analysis(self, analysis_id: str):
        """Main workflow processing logic"""
        try:
            analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
            if not analysis:
                logger.error(f"Analysis {analysis_id} not found")
                return
            
            # Step 1: Fetch blog content
            await self._update_analysis_status(analysis_id, AnalysisStatus.ANALYZING)
            blog_content = await self.blog_service.fetch_blog_content(analysis.blog_url)
            
            if not blog_content:
                await self._fail_analysis(analysis_id, "Failed to fetch blog content")
                return
            
            # Update with blog content
            analysis.blog_content = blog_content
            self.db.commit()
            
            # Step 2: Extract IoCs using Gemini
            await self._update_analysis_status(analysis_id, AnalysisStatus.EXTRACTING_IOCS)
            logger.info(f"Starting LLM analysis for blog content (length: {len(blog_content)} chars)")
            
            implementation_plan = self.gemini_service.analyze_threat_blog(blog_content)
            
            # Validate that the implementation plan was properly generated
            if not implementation_plan:
                await self._fail_analysis(analysis_id, "LLM failed to generate implementation plan - returned None")
                return
            
            logger.info(f"LLM successfully generated implementation plan with hypothesis: {implementation_plan.hypothesis[:200]}...")
            logger.info(f"LLM extracted {len(implementation_plan.iocs_and_ttps)} IoCs/TTPs")
            
            # Log each extracted IoC/TTP for debugging
            for i, ioc in enumerate(implementation_plan.iocs_and_ttps):
                logger.info(f"IoC/TTP {i+1}: {ioc.indicator} (type: {ioc.type}, priority: {ioc.priority})")
            
            # Step 3: Generate workflow steps
            await self._update_analysis_status(analysis_id, AnalysisStatus.PLANNING)
            workflow_steps = self._generate_workflow_steps(implementation_plan)
            logger.info(f"Generated {len(workflow_steps)} workflow steps")
            logger.info(f"Implementation Plan: Hypothesis {implementation_plan.hypothesis}")
            logger.info(f"Implementation Plan: IoCs/TTPs {implementation_plan.iocs_and_ttps}")
            
            
            # Update database with plan and steps
            plan_dict = implementation_plan.model_dump() if hasattr(implementation_plan, 'model_dump') else implementation_plan.dict()
            workflow_steps_dict = [step.model_dump() if hasattr(step, 'model_dump') else step.dict() for step in workflow_steps]
            
            analysis.implementation_plan = plan_dict
            analysis.workflow_steps = workflow_steps_dict
            self.db.commit()
            
            # Simple verification
            if not analysis.implementation_plan:
                await self._fail_analysis(analysis_id, "Implementation plan failed to save to database")
                return
            
            logger.info(f"Implementation plan saved with {len(plan_dict.get('iocs_and_ttps', []))} IoCs/TTPs")
            
            # Step 4: Distribute tasks to edge nodes
            await self._update_analysis_status(analysis_id, AnalysisStatus.DISTRIBUTING)
            await self._distribute_tasks(analysis_id, workflow_steps)
            
            # Step 5: Monitor and coordinate execution
            await self._update_analysis_status(analysis_id, AnalysisStatus.SCANNING)
            await self._monitor_execution(analysis_id)
            
            # Step 6: Correlate results
            await self._update_analysis_status(analysis_id, AnalysisStatus.CORRELATING)
            await self._correlate_results(analysis_id)
            
            # Complete analysis
            analysis.status = AnalysisStatus.COMPLETED
            analysis.completed_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Completed threat analysis {analysis_id}")
            
        except Exception as e:
            logger.error(f"Error in threat analysis {analysis_id}: {str(e)}")
            logger.error(traceback.format_exc())
            await self._fail_analysis(analysis_id, str(e))
        finally:
            # Clean up
            if analysis_id in self.active_analyses:
                del self.active_analyses[analysis_id]
    
    def _generate_workflow_steps(self, implementation_plan: ImplementationPlan) -> List[WorkflowStep]:
        """Generate workflow steps from implementation plan"""
        steps = []
        step_counter = 1
        
        # Generate steps for each IoC/TTP
        for item in implementation_plan.iocs_and_ttps:
            step_id = str(uuid.uuid4())
            step = WorkflowStep(
                step_id=step_id,
                name=f"Investigate: {item.indicator}",
                description=item.search_description,
                task_type=f"threat_hunt_{item.type.lower()}",
                assigned_nodes=[],  # Will be populated when distributing
                dependencies=[],
                status="pending",
                progress=0,
                job_ids={}
            )
            steps.append(step)
            step_counter += 1
        
        # Add correlation step if we have multiple investigation steps
        if len(steps) > 1:
            correlation_step = WorkflowStep(
                step_id=str(uuid.uuid4()),
                name="Evidence Correlation",
                description="Correlate findings across all edge nodes",
                task_type="evidence_correlation",
                assigned_nodes=[],
                dependencies=[step.step_id for step in steps],
                status="pending",
                progress=0,
                job_ids={}
            )
            steps.append(correlation_step)
        
        return steps
    
    async def _distribute_tasks(self, analysis_id: str, workflow_steps: List[WorkflowStep]):
        """Distribute tasks to edge nodes"""
        # Discover available nodes
        available_nodes = await self.edge_service.discover_nodes()
        
        if not available_nodes:
            raise Exception("No edge nodes available")
        
        node_ids = [node.node_id for node in available_nodes]
        
        # Distribute investigation tasks to all nodes
        for step in workflow_steps:
            if step.task_type.startswith("threat_hunt_"):
                # Get the indicator details from the implementation plan
                analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
                plan_data = analysis.implementation_plan
                
                # Validate that plan_data exists and is properly structured
                if not plan_data:
                    logger.error(f"Implementation plan is None for analysis {analysis_id} - cannot distribute task for step {step.name} {plan_data}")
                    continue
                
                if not isinstance(plan_data, dict):
                    logger.error(f"Implementation plan is not a dictionary for analysis {analysis_id}: {type(plan_data)}")
                    continue
                
                if "iocs_and_ttps" not in plan_data:
                    logger.error(f"Implementation plan missing 'iocs_and_ttps' key for analysis {analysis_id}: {list(plan_data.keys())}")
                    continue
                
                logger.info(f"Retrieved implementation plan with {len(plan_data.get('iocs_and_ttps', []))} IoCs/TTPs for step: {step.name}")
                
                # Find the corresponding IoC
                indicator_data = None
                iocs_list = plan_data.get("iocs_and_ttps", [])
                logger.debug(f"Searching for indicator matching step name '{step.name}' in {len(iocs_list)} IoCs")
                
                for ioc in iocs_list:
                    logger.debug(f"Checking IoC: {ioc.get('indicator', 'NO_INDICATOR')} against step name ending")
                    if step.name.endswith(ioc.get("indicator", "")):
                        indicator_data = ioc
                        logger.info(f"Found matching IoC for step '{step.name}': {ioc.get('indicator')}")
                        break
                
                if not indicator_data:
                    logger.warning(f"No matching IoC found for step '{step.name}' in implementation plan. Available indicators: {[ioc.get('indicator', 'NO_INDICATOR') for ioc in iocs_list]}")
                    continue
                
                # We have valid indicator_data, proceed with task creation
                task_parameters = {
                    "indicator": indicator_data["indicator"],
                    "type": indicator_data["type"],
                    "search_description": indicator_data["search_description"],
                    "priority": indicator_data["priority"],
                    "analysis_id": analysis_id,
                    "step_id": step.step_id
                }
                
                # Submit to all nodes
                job_mappings = await self.edge_service.distribute_task_to_all_nodes(
                    step.task_type, task_parameters
                )
                
                # Update step with job mappings
                step.assigned_nodes = list(job_mappings.keys())
                step.job_ids = job_mappings
                step.status = "running"
        
        # Update database
        analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
        analysis.workflow_steps = [step.dict() for step in workflow_steps]
        self.db.commit()
    
    async def _monitor_execution(self, analysis_id: str):
        """Monitor execution of all workflow steps"""
        max_iterations = 60  # Maximum monitoring cycles
        iteration = 0
        
        while iteration < max_iterations:
            analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
            workflow_steps = [WorkflowStep(**step) for step in analysis.workflow_steps]
            
            all_completed = True
            any_progress = False
            
            for step in workflow_steps:
                if step.status == "running" and step.job_ids:
                    # Poll job status from all assigned nodes
                    job_statuses = await self.edge_service.poll_all_jobs(step.job_ids)
                    
                    completed_jobs = 0
                    total_progress = 0
                    
                    for node_id, job_status in job_statuses.items():
                        if job_status:
                            if job_status.status == "completed":
                                completed_jobs += 1
                                total_progress += 100
                            elif job_status.status == "running":
                                total_progress += job_status.progress
                                any_progress = True
                            elif job_status.status == "failed":
                                logger.error(f"Job failed on node {node_id}: {job_status.error_message}")
                    
                    # Calculate overall step progress
                    if job_statuses:
                        step.progress = total_progress // len(job_statuses)
                    
                    # Check if step is complete
                    if completed_jobs == len(step.job_ids):
                        step.status = "completed"
                        step.progress = 100
                        logger.info(f"Step {step.name} completed")
                    else:
                        all_completed = False
                
                elif step.status in ["pending", "running"]:
                    all_completed = False
            
            # Update database with progress
            analysis.workflow_steps = [step.dict() for step in workflow_steps]
            self.db.commit()
            
            if all_completed:
                break
            
            # Wait before next poll
            await asyncio.sleep(2)
            iteration += 1
        
        if iteration >= max_iterations:
            logger.warning(f"Analysis {analysis_id} monitoring timed out")
    
    async def _correlate_results(self, analysis_id: str):
        """Correlate results from all edge nodes"""
        analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
        workflow_steps = [WorkflowStep(**step) for step in analysis.workflow_steps]
        
        node_results = {}
        
        # Collect results from all completed jobs
        for step in workflow_steps:
            if step.status == "completed" and step.job_ids:
                for node_id, job_id in step.job_ids.items():
                    result = await self.edge_service.get_job_result(node_id, job_id)
                    if result:
                        if node_id not in node_results:
                            node_results[node_id] = []
                        node_results[node_id].append({
                            "step_id": step.step_id,
                            "step_name": step.name,
                            "result": result
                        })
        
        # Store aggregated results
        analysis.node_results = node_results
        self.db.commit()
        logger.info(f"Correlated results from {len(node_results)} nodes for analysis {analysis_id}")
    
    async def _update_analysis_status(self, analysis_id: str, status: AnalysisStatus):
        """Update analysis status in database"""
        analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
        if analysis:
            analysis.status = status
            self.db.commit()
            logger.info(f"Updated analysis {analysis_id} status to {status}")
    
    async def _fail_analysis(self, analysis_id: str, error_message: str):
        """Mark analysis as failed"""
        analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
        if analysis:
            analysis.status = AnalysisStatus.FAILED
            analysis.error_message = error_message
            analysis.completed_at = datetime.utcnow()
            self.db.commit()
            logger.error(f"Failed analysis {analysis_id}: {error_message}")
    
    def get_analysis_status(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of an analysis"""
        analysis = self.db.query(ThreatAnalysisDB).filter(ThreatAnalysisDB.id == analysis_id).first()
        if not analysis:
            return None
        
        # Calculate overall progress
        overall_progress = 0
        if analysis.workflow_steps:
            steps = [WorkflowStep(**step) for step in analysis.workflow_steps]
            if steps:
                overall_progress = sum(step.progress for step in steps) // len(steps)
        
        return {
            "analysis_id": analysis.id,
            "status": analysis.status,
            "progress": overall_progress,
            "steps": analysis.workflow_steps or [],
            "implementation_plan": analysis.implementation_plan,
            "node_results": analysis.node_results or {},
            "created_at": analysis.created_at,
            "error_message": analysis.error_message
        }
    
    async def cleanup(self):
        """Clean up resources"""
        await self.blog_service.close()
        await self.edge_service.close()