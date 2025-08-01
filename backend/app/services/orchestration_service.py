import asyncio
import traceback
import uuid
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from app.core.database import SimpleStorage, ThreatAnalysis, AnalysisStatus
from app.models.threat_analysis import ImplementationPlan, WorkflowStep
from app.services.gemini_service import GeminiService
from app.services.edge_node_service import EdgeNodeService

logger = logging.getLogger(__name__)

class OrchestrationService:
    _cleanup_task: Optional[asyncio.Task] = None
    
    def __init__(self, storage: SimpleStorage, enable_cleanup: bool = True):
        self.storage = storage
        self.gemini_service = GeminiService()
        self.edge_service = EdgeNodeService()
        self.active_analyses: Dict[str, asyncio.Task] = {}
        
        if enable_cleanup:
            self._setup_cleanup_task()
    
    async def start_threat_analysis(self, blog_url: str) -> str:
        """Start a new threat analysis workflow"""
        # Create analysis record
        analysis_id = self.storage.create_analysis(blog_url)
        
        # Start background processing
        task = asyncio.create_task(self._process_threat_analysis(analysis_id))
        self.active_analyses[analysis_id] = task
        
        logger.info(f"Started threat analysis {analysis_id} for URL: {blog_url}")
        return analysis_id
    
    async def _process_threat_analysis(self, analysis_id: str):
        """Main workflow processing logic"""
        try:
            analysis = self.storage.get_analysis(analysis_id)
            if not analysis:
                logger.error(f"Analysis {analysis_id} not found")
                return
            
            # Step 1: Extract IoCs using Gemini (directly from URL)
            await self._update_analysis_status(analysis_id, AnalysisStatus.ANALYZING)
            await self._update_analysis_status(analysis_id, AnalysisStatus.EXTRACTING_IOCS)
            logger.info(f"Starting LLM analysis for blog URL: {analysis.blog_url}")
            
            implementation_plan = await self.gemini_service.analyze_threat_blog(analysis.blog_url)
            
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
            
            
            # Update storage with plan and steps
            plan_dict = implementation_plan.model_dump() if hasattr(implementation_plan, 'model_dump') else implementation_plan.dict()
            workflow_steps_dict = [step.model_dump() if hasattr(step, 'model_dump') else step.dict() for step in workflow_steps]
            
            logger.info(f"About to save plan_dict type: {type(plan_dict)}, keys: {list(plan_dict.keys()) if isinstance(plan_dict, dict) else 'NOT_DICT'}")
            logger.info(f"Plan dict size: {len(str(plan_dict))} characters")
            
            # Update the analysis with the implementation plan and workflow steps
            success = self.storage.update_analysis(
                analysis_id,
                implementation_plan=plan_dict,
                workflow_steps=workflow_steps_dict
            )
            
            if not success:
                await self._fail_analysis(analysis_id, "Failed to update analysis in storage")
                return
            
            # Verify the update
            updated_analysis = self.storage.get_analysis(analysis_id)
            logger.info(f"After update - implementation_plan type: {type(updated_analysis.implementation_plan)}")
            logger.info(f"After update - implementation_plan is None: {updated_analysis.implementation_plan is None}")
            
            if not updated_analysis.implementation_plan:
                await self._fail_analysis(analysis_id, "Implementation plan failed to save to storage")
                return
            
            logger.info(f"Implementation plan saved with {len(plan_dict.get('iocs_and_ttps', []))} IoCs/TTPs")
            
            # Step 4: Distribute tasks to edge nodes
            await self._update_analysis_status(analysis_id, AnalysisStatus.DISTRIBUTING)
            await self._distribute_tasks(analysis_id, workflow_steps, implementation_plan)
            
            # Step 5: Monitor and coordinate execution
            await self._update_analysis_status(analysis_id, AnalysisStatus.SCANNING)
            await self._monitor_execution(analysis_id)
            
            # Step 6: Correlate results
            await self._update_analysis_status(analysis_id, AnalysisStatus.CORRELATING)
            await self._correlate_results(analysis_id)
            
            # Complete analysis
            self.storage.update_analysis(
                analysis_id,
                status=AnalysisStatus.COMPLETED,
                completed_at=datetime.utcnow()
            )
            
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
    
    async def _distribute_tasks(self, analysis_id: str, workflow_steps: List[WorkflowStep], implementation_plan: ImplementationPlan):
        """Distribute tasks to edge nodes"""
        # Discover available nodes
        available_nodes = await self.edge_service.discover_nodes()
        
        if not available_nodes:
            raise Exception("No edge nodes available")
        
        node_ids = [node.node_id for node in available_nodes]
        
        # Distribute investigation tasks to all nodes
        for step in workflow_steps:
            if step.task_type.startswith("threat_hunt_"):
                # Use the passed implementation plan directly instead of querying database
                logger.info(f"Processing step {step.name} with implementation plan (type: {type(implementation_plan)})")
                
                if not implementation_plan:
                    logger.error(f"Implementation plan is None for analysis {analysis_id} - cannot distribute task for step {step.name}")
                    continue
                
                iocs_list = implementation_plan.iocs_and_ttps
                logger.info(f"Using implementation plan with {len(iocs_list)} IoCs/TTPs for step: {step.name}")
                logger.info(f"IoCs list type: {type(iocs_list)}")
                
                # Log all available IoCs for debugging
                for i, ioc in enumerate(iocs_list):
                    logger.info(f"IoC {i}: indicator='{ioc.indicator}', type='{ioc.type}', priority='{ioc.priority}'")
                
                # Find the corresponding IoC
                indicator_data = None
                logger.info(f"Searching for indicator matching step name '{step.name}' in {len(iocs_list)} IoCs")
                
                for i, ioc in enumerate(iocs_list):
                    ioc_indicator = ioc.indicator
                    logger.info(f"Checking IoC {i}: '{ioc_indicator}' against step name '{step.name}'")
                    logger.info(f"Step name ends with '{ioc_indicator}': {step.name.endswith(ioc_indicator)}")
                    
                    if step.name.endswith(ioc_indicator):
                        indicator_data = ioc
                        logger.info(f"✓ Found matching IoC for step '{step.name}': {ioc_indicator}")
                        break
                
                if not indicator_data:
                    logger.error(f"❌ No matching IoC found for step '{step.name}' in implementation plan.")
                    logger.error(f"Available indicators: {[ioc.indicator for ioc in iocs_list]}")
                    logger.error(f"Step name: '{step.name}'")
                    continue
                
                # We have valid indicator_data, proceed with task creation
                task_parameters = {
                    "indicator": indicator_data.indicator,
                    "type": indicator_data.type,
                    "search_description": indicator_data.search_description,
                    "priority": indicator_data.priority,
                    "analysis_id": analysis_id,
                    "step_id": step.step_id
                }
                
                logger.info(f"✓ Created task parameters for step '{step.name}': {task_parameters}")
                
                # Submit to all nodes
                job_mappings = await self.edge_service.distribute_task_to_all_nodes(
                    step.task_type, task_parameters
                )
                
                # Update step with job mappings
                step.assigned_nodes = list(job_mappings.keys())
                step.job_ids = job_mappings
                step.status = "running"
        
        # Update storage
        workflow_steps_dict = [step.dict() for step in workflow_steps]
        self.storage.update_analysis(analysis_id, workflow_steps=workflow_steps_dict)
    
    async def _monitor_execution(self, analysis_id: str):
        """Monitor execution of all workflow steps"""
        max_iterations = 60  # Maximum monitoring cycles
        iteration = 0
        
        while iteration < max_iterations:
            analysis = self.storage.get_analysis(analysis_id)
            workflow_steps = [WorkflowStep(**step) for step in analysis.workflow_steps or []]
            
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
            
            # Update storage with progress
            workflow_steps_dict = [step.dict() for step in workflow_steps]
            self.storage.update_analysis(analysis_id, workflow_steps=workflow_steps_dict)
            
            if all_completed:
                break
            
            # Wait before next poll
            await asyncio.sleep(2)
            iteration += 1
        
        if iteration >= max_iterations:
            logger.warning(f"Analysis {analysis_id} monitoring timed out")
    
    async def _correlate_results(self, analysis_id: str):
        """Correlate results from all edge nodes"""
        analysis = self.storage.get_analysis(analysis_id)
        workflow_steps = [WorkflowStep(**step) for step in analysis.workflow_steps or []]
        
        node_results = {}
        correlation_step = None
        
        # Find the correlation step
        for step in workflow_steps:
            if step.task_type == "evidence_correlation":
                correlation_step = step
                break
        
        # Collect results from all completed jobs
        for step in workflow_steps:
            if step.status == "completed" and step.job_ids:
                for node_id, job_id in step.job_ids.items():
                    result = await self.edge_service.get_job_result(node_id, job_id)
                    if result:
                        if node_id not in node_results:
                            node_results[node_id] = []
                        
                        step_result_data = {
                            "step_id": step.step_id,
                            "step_name": step.name,
                            "result": result
                        }
                        node_results[node_id].append(step_result_data)
                        
                        # Also populate the step.result field to link the data properly
                        if not step.result:
                            step.result = {}
                        if node_id not in step.result:
                            step.result[node_id] = []
                        step.result[node_id].append(result)
        
        # Mark correlation step as completed
        if correlation_step:
            correlation_step.status = "completed"
            correlation_step.progress = 100
            logger.info(f"Evidence correlation completed for analysis {analysis_id}")
        
        # Update workflow steps with linked results
        workflow_steps_dict = [step.dict() for step in workflow_steps]
        
        # Store aggregated results and updated workflow steps
        self.storage.update_analysis(
            analysis_id, 
            node_results=node_results,
            workflow_steps=workflow_steps_dict
        )
        logger.info(f"Correlated results from {len(node_results)} nodes for analysis {analysis_id}")
    
    async def _update_analysis_status(self, analysis_id: str, status: AnalysisStatus):
        """Update analysis status in storage"""
        success = self.storage.update_analysis(analysis_id, status=status)
        if success:
            logger.info(f"Updated analysis {analysis_id} status to {status}")
        else:
            logger.error(f"Failed to update analysis {analysis_id} status to {status}")
    
    async def _fail_analysis(self, analysis_id: str, error_message: str):
        """Mark analysis as failed"""
        success = self.storage.update_analysis(
            analysis_id,
            status=AnalysisStatus.FAILED,
            error_message=error_message,
            completed_at=datetime.utcnow()
        )
        if success:
            logger.error(f"Failed analysis {analysis_id}: {error_message}")
        else:
            logger.error(f"Failed to update failed analysis {analysis_id}: {error_message}")
    
    @staticmethod
    def get_analysis_status_static(storage: SimpleStorage, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of an analysis (static method for fast status checks)"""
        analysis = storage.get_analysis(analysis_id)
        if not analysis:
            return None
        
        # Calculate overall progress
        overall_progress = 0
        if analysis.workflow_steps:
            try:
                steps = [WorkflowStep(**step) for step in analysis.workflow_steps]
                if steps:
                    # If analysis status is completed, progress should be 100%
                    analysis_status = analysis.status.value if isinstance(analysis.status, AnalysisStatus) else analysis.status
                    if analysis_status == "completed":
                        overall_progress = 100
                    else:
                        # Count completed steps for better accuracy
                        completed_steps = sum(1 for step in steps if step.status == "completed")
                        overall_progress = (completed_steps * 100) // len(steps)
            except Exception:
                # If workflow steps are malformed, just use 0 progress
                overall_progress = 0
        
        return {
            "analysis_id": analysis.id,
            "status": analysis.status.value if isinstance(analysis.status, AnalysisStatus) else analysis.status,
            "progress": overall_progress,
            "steps": analysis.workflow_steps or [],
            "implementation_plan": analysis.implementation_plan,
            "node_results": analysis.node_results or {},
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "error_message": analysis.error_message
        }
    
    @staticmethod
    def get_structured_analysis_status(storage: SimpleStorage, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get analysis status with improved structure for better usability"""
        analysis = storage.get_analysis(analysis_id)
        if not analysis:
            return None
        
        # Calculate overall progress
        overall_progress = 0
        completed_steps = 0
        total_steps = 0
        
        steps_summary = []
        if analysis.workflow_steps:
            try:
                steps = [WorkflowStep(**step) for step in analysis.workflow_steps]
                total_steps = len(steps)
                
                for step in steps:
                    if step.status == "completed":
                        completed_steps += 1
                    
                    steps_summary.append({
                        "step_id": step.step_id,
                        "name": step.name,
                        "task_type": step.task_type,
                        "status": step.status,
                        "progress": step.progress,
                        "assigned_nodes": step.assigned_nodes
                    })
                
                if total_steps > 0:
                    overall_progress = (completed_steps * 100) // total_steps
                    
            except Exception:
                overall_progress = 0
        
        # Aggregate evidence across all nodes (using both node_results and step.result for completeness)
        all_evidence = []
        threat_indicators = {}
        affected_nodes = set()
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        # Primary evidence aggregation from node_results
        node_results = analysis.node_results or {}
        for node_id, node_data in node_results.items():
            if isinstance(node_data, list):
                for step_result in node_data:
                    step_evidence = step_result.get("result", {}).get("evidence", [])
                    for evidence in step_evidence:
                        # Enrich evidence with step context
                        enriched_evidence = {
                            **evidence,
                            "step_name": step_result.get("step_name", "Unknown"),
                            "node_hostname": step_result.get("result", {}).get("hostname", node_id)
                        }
                        all_evidence.append(enriched_evidence)
                        
                        # Track threat indicators
                        indicator = evidence.get("indicator", "Unknown")
                        if indicator not in threat_indicators:
                            threat_indicators[indicator] = {
                                "total_occurrences": 0,
                                "affected_nodes": set(),
                                "highest_severity": "low",
                                "evidence_types": set()
                            }
                        
                        threat_indicators[indicator]["total_occurrences"] += 1
                        threat_indicators[indicator]["affected_nodes"].add(node_id)
                        threat_indicators[indicator]["evidence_types"].add(evidence.get("type", "unknown"))
                        
                        # Update highest severity
                        severity = evidence.get("severity", "low")
                        severity_counts[severity] = severity_counts.get(severity, 0) + 1
                        affected_nodes.add(node_id)
                        
                        current_severity = threat_indicators[indicator]["highest_severity"]
                        severity_levels = {"low": 1, "medium": 2, "high": 3, "critical": 4}
                        if severity_levels.get(severity, 1) > severity_levels.get(current_severity, 1):
                            threat_indicators[indicator]["highest_severity"] = severity
        
        # Convert sets to lists for JSON serialization
        for indicator_data in threat_indicators.values():
            indicator_data["affected_nodes"] = list(indicator_data["affected_nodes"])
            indicator_data["evidence_types"] = list(indicator_data["evidence_types"])
        
        # Generate executive summary
        total_evidence = len(all_evidence)
        threat_detected = total_evidence > 0
        risk_level = "low"
        
        if severity_counts["critical"] > 0:
            risk_level = "critical"
        elif severity_counts["high"] > 0:
            risk_level = "high"
        elif severity_counts["medium"] > 0:
            risk_level = "medium"
        
        # Generate recommendations based on findings
        recommendations = []
        if threat_detected:
            if risk_level in ["critical", "high"]:
                recommendations.extend([
                    "Immediately isolate affected systems from network",
                    "Initiate incident response procedures",
                    "Collect forensic artifacts from affected nodes",
                    "Monitor for lateral movement indicators"
                ])
            else:
                recommendations.extend([
                    "Continue monitoring for additional indicators",
                    "Review and update detection signatures",
                    "Conduct deeper analysis on identified artifacts"
                ])
        else:
            recommendations.extend([
                "Continue routine monitoring",
                "Update threat intelligence feeds",
                "Schedule periodic threat hunting activities"
            ])
        
        return {
            "analysis_id": analysis.id,
            "status": analysis.status.value if isinstance(analysis.status, AnalysisStatus) else analysis.status,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "error_message": analysis.error_message,
            
            # Executive Summary
            "summary": {
                "overall_progress": overall_progress,
                "completed_steps": completed_steps,
                "total_steps": total_steps,
                "threat_detected": threat_detected,
                "risk_level": risk_level,
                "total_evidence": total_evidence,
                "affected_nodes_count": len(affected_nodes),
                "unique_indicators": len(threat_indicators)
            },
            
            # Evidence Analysis
            "evidence": {
                "total_count": total_evidence,
                "by_severity": severity_counts,
                "by_node": {node_id: len([e for e in all_evidence if e.get("node_id") == node_id]) 
                           for node_id in affected_nodes},
                "findings": sorted(all_evidence, 
                                 key=lambda x: {"critical": 4, "high": 3, "medium": 2, "low": 1}
                                 .get(x.get("severity", "low"), 1), reverse=True)
            },
            
            # Threat Intelligence
            "threat_indicators": {
                indicator: {
                    **data,
                    "risk_score": len(data["affected_nodes"]) * 
                                {"critical": 4, "high": 3, "medium": 2, "low": 1}
                                .get(data["highest_severity"], 1)
                }
                for indicator, data in threat_indicators.items()
            },
            
            # Step Progress (now with linked results in step.result field)
            "workflow": {
                "steps": steps_summary,
                "implementation_plan": analysis.implementation_plan
            },
            
            # Actionable Intelligence
            "recommendations": recommendations,
            "affected_nodes": list(affected_nodes),
            
            # Raw data (for detailed analysis if needed)
            "raw_data": {
                "steps": analysis.workflow_steps or [],
                "node_results": analysis.node_results or {}
            }
        }
    
    def get_analysis_status(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of an analysis (instance method)"""
        return self.get_analysis_status_static(self.storage, analysis_id)
    
    @classmethod
    def _setup_cleanup_task(cls):
        """Setup periodic cleanup of completed analyses (class-level singleton)"""
        if not cls._cleanup_task or cls._cleanup_task.done():
            try:
                cls._cleanup_task = asyncio.create_task(cls._periodic_cleanup_static())
            except RuntimeError:
                # No event loop running, skip cleanup task setup
                pass
    
    @classmethod
    async def _periodic_cleanup_static(cls):
        """Periodically clean up completed analysis tasks (static version)"""
        while True:
            try:
                # For now, this is a placeholder - cleanup will be handled per instance
                # TODO: Implement shared cleanup if needed
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error(f"Error in static cleanup task: {str(e)}")
                await asyncio.sleep(300)
    
    def get_active_analyses_count(self) -> int:
        """Get count of currently active analyses"""
        return len(self.active_analyses)
    
    def get_active_analyses_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about active analyses"""
        info = {}
        for analysis_id, task in self.active_analyses.items():
            info[analysis_id] = {
                "done": task.done(),
                "cancelled": task.cancelled()
            }
        return info
    
    async def cancel_analysis(self, analysis_id: str) -> bool:
        """Cancel a running analysis"""
        if analysis_id in self.active_analyses:
            task = self.active_analyses[analysis_id]
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                logger.info(f"Cancelled analysis: {analysis_id}")
                return True
        return False
    
    async def cleanup(self):
        """Clean up resources"""
        # Cancel cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Cancel all active analyses
        for analysis_id, task in list(self.active_analyses.items()):
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        self.active_analyses.clear()
        await self.edge_service.close()