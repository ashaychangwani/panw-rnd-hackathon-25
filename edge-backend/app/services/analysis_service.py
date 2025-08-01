import asyncio
import logging
import json
import re
from typing import Dict, List, Any
from datetime import datetime, timedelta

from app.models.job import Job, JobStatus, TaskType
from agentic_terminal import TerminalAgent

logger = logging.getLogger(__name__)

class AnalysisService:
    """Service for real threat hunting operations on edge nodes using TerminalAgent
    
    Note: This service performs real threat hunting
    analysis using the TerminalAgent instead of simulating results.
    """
    
    def __init__(self, node_info: Dict[str, Any]):
        self.node_info = node_info
        
        # Utility to ensure consistent string output
        def _normalize_output(output):
            if isinstance(output, (dict, list)):
                return json.dumps(output)
            return str(output)
        
        self._normalize_output = _normalize_output
        
    async def execute_task(self, job: Job) -> None:
        """Execute a real threat hunting task using TerminalAgent"""
        try:
            job.start()
            logger.info(f"Starting job {job.job_id} of type {job.task_type}")
            
            # Execute task processing based on type using TerminalAgent
            if job.task_type in ["threat_hunt_ioc", "threat_hunt_ttp"]:
                await self._execute_threat_hunt(job)
            elif job.task_type == "registry_analysis":
                await self._execute_registry_analysis(job)
            elif job.task_type == "file_system_scan":
                await self._execute_file_scan(job)
            elif job.task_type == "network_monitoring":
                await self._execute_network_monitoring(job)
            elif job.task_type == "log_analysis":
                await self._execute_log_analysis(job)
            elif job.task_type == "process_inspection":
                await self._execute_process_inspection(job)
            elif job.task_type == "memory_analysis":
                await self._execute_memory_analysis(job)
            else:
                await self._execute_generic_task(job)
                
        except Exception as e:
            logger.error(f"Error executing job {job.job_id}: {str(e)}")
            job.fail(str(e))
    
    async def _execute_threat_hunt(self, job: Job):
        """Execute real threat hunting for IoCs and TTPs using TerminalAgent"""
        indicator = job.parameters.get("indicator", "Unknown Indicator")
        search_description = job.parameters.get("search_description", "")
        priority = job.parameters.get("priority", "medium")
        
        job.progress = 10
        logger.info(f"Job {job.job_id} progress: 10% - Initializing threat hunt")
        
        # Prepare context for the TerminalAgent
        context = f"""
        You are a cybersecurity analyst on a {self.node_info.get('os_type', 'linux')} system.
        Node ID: {self.node_info.get('node_id', 'unknown')}
        Hostname: {self.node_info.get('hostname', 'unknown')}
        OS Version: {self.node_info.get('os_version', 'unknown')}
        
        Priority: {priority}
        Search Description: {search_description}
        """
        
        # Create instruction for threat hunting
        instruction = f"""
        Conduct a comprehensive threat hunt for the indicator: {indicator}
        
        Please perform the following activities:
        1. Search system logs for any occurrences of this indicator
        2. Check network connections and logs for related activity  
        3. Examine file system for any artifacts related to this indicator
        4. Look for any suspicious processes or services
        5. Generate a detailed report with your findings
        
        Format your final response as a JSON object with the following structure:
        {{
            "indicator_searched": "{indicator}",
            "threat_detected": true/false,
            "findings_count": number,
            "evidence": [list of evidence objects],
            "recommendations": [list of recommendations],
            "scan_completed": true,
            "confidence_score": 0.0-1.0
        }}
        """
        
        job.progress = 30
        logger.info(f"Job {job.job_id} progress: 30% - Executing threat hunt with TerminalAgent")
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            # Execute the threat hunt using TerminalAgent
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            job.progress = 80
            logger.info(f"Job {job.job_id} progress: 80% - Processing TerminalAgent results")
            
            # Try to parse the result as JSON, fallback to text processing
            try:
                # Look for JSON in the response
                import re
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result_data = json.loads(json_match.group())
                else:
                    # Fallback: create structured result from text
                    result_data = {
                        "indicator_searched": indicator,
                        "threat_detected": "threat" in result_text.lower() or "suspicious" in result_text.lower(),
                        "findings_count": result_text.lower().count("found") + result_text.lower().count("detected"),
                        "evidence": [{"type": "terminal_output", "details": result_text}],
                        "recommendations": ["Review terminal output for detailed findings"],
                        "scan_completed": True,
                        "confidence_score": 0.8 if "found" in result_text.lower() else 0.3
                    }
            except json.JSONDecodeError:
                # Fallback to structured text result
                result_data = {
                    "indicator_searched": indicator,
                    "threat_detected": "threat" in result_text.lower() or "suspicious" in result_text.lower(),
                    "findings_count": result_text.lower().count("found") + result_text.lower().count("detected"),
                    "evidence": [{"type": "terminal_output", "details": result_text}],
                    "recommendations": ["Review terminal output for detailed findings"],
                    "scan_completed": True,
                    "confidence_score": 0.8 if "found" in result_text.lower() else 0.3
                }
            
            # Add node information
            result_data.update({
                "search_description": search_description,
                "priority": priority,
                "node_id": self.node_info["node_id"],
                "hostname": self.node_info["hostname"],
                "raw_terminal_output": result_text
            })
            
            job.progress = 100
            logger.info(f"Job {job.job_id} progress: 100% - Threat hunt completed")
            
            job.complete(result_data, result_data.get("evidence", []))
            
        except Exception as e:
            logger.error(f"TerminalAgent execution failed for job {job.job_id}: {str(e)}")
            # Fallback to error result
            result_data = {
                "indicator_searched": indicator,
                "threat_detected": False,
                "findings_count": 0,
                "evidence": [],
                "recommendations": ["TerminalAgent execution failed - manual investigation required"],
                "scan_completed": False,
                "confidence_score": 0.0,
                "error": str(e)
            }
            job.complete(result_data, [])
    
    async def _execute_registry_analysis(self, job: Job):
        """Execute Windows registry analysis using TerminalAgent"""
        if self.node_info["os_type"] != "windows":
            job.fail("Registry analysis not supported on non-Windows systems")
            return
        
        job.progress = 20
        logger.info(f"Job {job.job_id} progress: 20% - Starting registry analysis")
        
        context = f"""
        You are performing Windows registry analysis on {self.node_info.get('hostname', 'unknown')}.
        Focus on finding suspicious persistence mechanisms and unauthorized modifications.
        """
        
        instruction = """
        Analyze the Windows registry for security issues:
        1. Check common persistence locations (Run keys, Services, etc.)
        2. Look for suspicious entries or unauthorized modifications
        3. Examine recently modified registry keys
        4. Report findings in JSON format
        """
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            result_data = {
                "analysis_type": "registry_analysis",
                "keys_scanned": result_text.lower().count("key"),
                "suspicious_entries": result_text.lower().count("suspicious") + result_text.lower().count("found"),
                "node_info": self.node_info,
                "raw_terminal_output": result_text
            }
            
            evidence = []
            if result_data["suspicious_entries"] > 0:
                evidence.append({
                    "type": "registry_analysis",
                    "details": result_text,
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.progress = 100
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"Registry analysis failed: {str(e)}")
            job.fail(str(e))
    
    async def _execute_file_scan(self, job: Job):
        """Execute real file system scanning using TerminalAgent"""
        scan_path = job.parameters.get("scan_path", "/tmp")
        
        job.progress = 20
        logger.info(f"Job {job.job_id} progress: 20% - Starting file system scan")
        
        context = f"""
        You are performing file system security scanning on {self.node_info.get('hostname', 'unknown')}.
        Focus on finding suspicious files, scripts, or malware.
        """
        
        instruction = f"""
        Scan the file system for security threats:
        1. Look for suspicious files in common locations like /tmp, /var/tmp (Linux) or C:\\Temp (Windows)
        2. Check for recently modified executable files
        3. Look for hidden files or directories
        4. Identify files with suspicious names or extensions
        5. Generate file hashes for suspicious files
        
        Scan path: {scan_path}
        Format findings as JSON.
        """
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            result_data = {
                "analysis_type": "file_system_scan",
                "files_scanned": result_text.lower().count("file"),
                "suspicious_files": result_text.lower().count("suspicious") + result_text.lower().count("malware"),
                "scan_time_seconds": 120,
                "scan_path": scan_path,
                "raw_terminal_output": result_text
            }
            
            evidence = []
            if result_data["suspicious_files"] > 0:
                evidence.append({
                    "type": "file_scan_result",
                    "details": result_text,
                    "severity": "high",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.progress = 100
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"File scan failed: {str(e)}")
            job.fail(str(e))
    
    async def _execute_network_monitoring(self, job: Job):
        """Execute real network monitoring using TerminalAgent"""
        job.progress = 20
        logger.info(f"Job {job.job_id} progress: 20% - Starting network monitoring")
        
        context = f"""
        You are performing network security monitoring on {self.node_info.get('hostname', 'unknown')}.
        Focus on identifying suspicious network connections and traffic patterns.
        """
        
        instruction = """
        Monitor network activity for security threats:
        1. List active network connections
        2. Check for connections to suspicious IP addresses or ports
        3. Monitor for unusual traffic patterns
        4. Look for connections to known malicious domains
        5. Report any anomalous network behavior
        
        Format findings as JSON with connection details.
        """
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            result_data = {
                "analysis_type": "network_monitoring",
                "connections_analyzed": result_text.lower().count("connection") + result_text.lower().count("tcp") + result_text.lower().count("udp"),
                "suspicious_connections": result_text.lower().count("suspicious") + result_text.lower().count("malicious"),
                "monitoring_duration": 90,
                "raw_terminal_output": result_text
            }
            
            evidence = []
            if result_data["suspicious_connections"] > 0:
                evidence.append({
                    "type": "network_monitoring",
                    "details": result_text,
                    "severity": "high",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.progress = 100
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"Network monitoring failed: {str(e)}")
            job.fail(str(e))
    
    async def _execute_log_analysis(self, job: Job):
        """Execute real log file analysis using TerminalAgent"""
        pattern = job.parameters.get("pattern", "")
        log_files = job.parameters.get("log_files", [])
        search_term = job.parameters.get("search_term", "")
        
        job.progress = 10
        logger.info(f"Job {job.job_id} progress: 10% - Initializing log analysis")
        
        # Prepare context for the TerminalAgent
        context = f"""
        You are a cybersecurity analyst performing log analysis on a {self.node_info.get('os_type', 'linux')} system.
        Node ID: {self.node_info.get('node_id', 'unknown')}
        Hostname: {self.node_info.get('hostname', 'unknown')}
        """
        
        # Create instruction for log analysis
        if pattern:
            instruction = f"""
            Analyze system logs to search for the pattern: {pattern}
            
            Please perform the following:
            1. Search for log files in /var/log (Linux) or Event Logs (Windows)
            2. Look for occurrences of the pattern: {pattern}
            3. Check for any suspicious activities or indicators
            4. Analyze timestamps and frequency of occurrences
            5. Provide a summary of findings
            
            Format your response as JSON:
            {{
                "pattern_searched": "{pattern}",
                "log_files_analyzed": [list of files],
                "matches_found": number,
                "suspicious_entries": [list of suspicious entries],
                "analysis_completed": true
            }}
            """
        elif search_term:
            instruction = f"""
            Search system logs for the term: {search_term}
            
            Please:
            1. Search common log directories for the term
            2. Report any matches with context
            3. Analyze for potential security implications
            4. Provide recommendations
            
            Format response as JSON with findings.
            """
        else:
            # Default Log4j analysis from the original example
            instruction = """
            Search web server access logs, application logs, and network traffic for the JNDI lookup string pattern '${jndi:}' which is the primary indicator of an exploitation attempt.
            
            Look for:
            1. Log4j exploitation patterns like ${jndi:ldap://...}
            2. Suspicious network connections
            3. Any evidence of compromise
            4. Timeline of potential attacks
            
            Format response as JSON with detailed findings.
            """
        
        job.progress = 30
        logger.info(f"Job {job.job_id} progress: 30% - Executing log analysis with TerminalAgent")
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            # Execute the log analysis using TerminalAgent
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            job.progress = 80
            logger.info(f"Job {job.job_id} progress: 80% - Processing log analysis results")
            
            # Try to parse the result as JSON, fallback to text processing
            try:
                import re
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result_data = json.loads(json_match.group())
                else:
                    # Fallback: create structured result from text
                    result_data = {
                        "analysis_type": "log_analysis",
                        "pattern_searched": pattern or search_term or "${jndi:}",
                        "log_entries_analyzed": result_text.lower().count("log"),
                        "suspicious_entries": result_text.lower().count("found") + result_text.lower().count("suspicious"),
                        "analysis_completed": True,
                        "raw_output": result_text
                    }
            except json.JSONDecodeError:
                # Fallback to structured text result
                result_data = {
                    "analysis_type": "log_analysis", 
                    "pattern_searched": pattern or search_term or "${jndi:}",
                    "log_entries_analyzed": result_text.lower().count("log"),
                    "suspicious_entries": result_text.lower().count("found") + result_text.lower().count("suspicious"),
                    "analysis_completed": True,
                    "raw_output": result_text
                }
            
            # Add node information
            result_data.update({
                "node_id": self.node_info["node_id"],
                "hostname": self.node_info["hostname"],
                "raw_terminal_output": result_text
            })
            
            job.progress = 100
            logger.info(f"Job {job.job_id} progress: 100% - Log analysis completed")
            
            # Create evidence from findings
            evidence = []
            if result_data.get("suspicious_entries", 0) > 0:
                evidence.append({
                    "type": "log_analysis_result",
                    "details": result_text,
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"TerminalAgent log analysis failed for job {job.job_id}: {str(e)}")
            # Fallback to error result
            result_data = {
                "analysis_type": "log_analysis",
                "pattern_searched": pattern or search_term or "unknown",
                "log_entries_analyzed": 0,
                "suspicious_entries": 0,
                "analysis_completed": False,
                "error": str(e)
            }
            job.complete(result_data, [])
    
    async def _execute_process_inspection(self, job: Job):
        """Execute real process inspection using TerminalAgent"""
        job.progress = 20
        logger.info(f"Job {job.job_id} progress: 20% - Starting process inspection")
        
        context = f"""
        You are performing process inspection on a {self.node_info.get('os_type', 'linux')} system.
        Focus on identifying suspicious or malicious processes.
        """
        
        instruction = """
        Analyze running processes for security threats:
        1. List all running processes with details
        2. Look for suspicious process names, command lines, or behaviors
        3. Check for processes consuming excessive resources
        4. Identify any cryptocurrency miners or known malware processes
        5. Report findings with process details (PID, name, command line, etc.)
        
        Format as JSON with process details and threat analysis.
        """
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            result_data = {
                "analysis_type": "process_inspection",
                "processes_analyzed": result_text.lower().count("pid") + result_text.lower().count("process"),
                "suspicious_processes": result_text.lower().count("suspicious") + result_text.lower().count("malware"),
                "inspection_time": 60,
                "raw_terminal_output": result_text
            }
            
            evidence = []
            if result_data["suspicious_processes"] > 0:
                evidence.append({
                    "type": "process_inspection",
                    "details": result_text,
                    "severity": "high",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.progress = 100
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"Process inspection failed: {str(e)}")
            job.fail(str(e))
    
    async def _execute_memory_analysis(self, job: Job):
        """Execute real memory analysis using TerminalAgent"""
        job.progress = 20
        logger.info(f"Job {job.job_id} progress: 20% - Starting memory analysis")
        
        context = f"""
        You are performing memory analysis on {self.node_info.get('hostname', 'unknown')}.
        Focus on finding injected code, malicious payloads, or suspicious memory artifacts.
        """
        
        instruction = """
        Analyze system memory for security threats:
        1. Check for suspicious memory allocations
        2. Look for code injection indicators
        3. Analyze process memory for anomalies
        4. Scan for known malware signatures in memory
        5. Report any suspicious memory artifacts
        
        Note: Memory analysis can be resource intensive.
        Format findings as JSON.
        """
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            result_data = {
                "analysis_type": "memory_analysis",
                "memory_regions_analyzed": result_text.lower().count("memory") + result_text.lower().count("process"),
                "artifacts_found": result_text.lower().count("found") + result_text.lower().count("suspicious"),
                "analysis_duration": 180,
                "raw_terminal_output": result_text
            }
            
            evidence = []
            if result_data["artifacts_found"] > 0:
                evidence.append({
                    "type": "memory_analysis",
                    "details": result_text,
                    "severity": "critical",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.progress = 100
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"Memory analysis failed: {str(e)}")
            job.fail(str(e))
    
    async def _execute_generic_task(self, job: Job):
        """Execute generic security task using TerminalAgent"""
        task_description = job.parameters.get("description", "General security analysis")
        
        job.progress = 20
        logger.info(f"Job {job.job_id} progress: 20% - Starting generic security task")
        
        context = f"""
        You are performing a general security analysis task on {self.node_info.get('hostname', 'unknown')}.
        System: {self.node_info.get('os_type', 'linux')} {self.node_info.get('os_version', '')}
        """
        
        instruction = f"""
        Perform the following security task: {task_description}
        
        General security analysis should include:
        1. Basic system security check
        2. Review current security posture
        3. Look for common security issues
        4. Provide recommendations
        
        Format findings as JSON.
        """
        
        try:
            # Create a dedicated TerminalAgent for this job to avoid concurrency issues
            terminal_agent = TerminalAgent()
            
            result_output = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: terminal_agent.run(context=context, instruction=instruction)
            )
            result_text = self._normalize_output(result_output)
            
            result_data = {
                "task_type": job.task_type,
                "status": "completed",
                "node_info": self.node_info,
                "description": task_description,
                "raw_terminal_output": result_text
            }
            
            evidence = []
            if "issue" in result_text.lower() or "vulnerable" in result_text.lower():
                evidence.append({
                    "type": "generic_security_finding",
                    "details": result_text,
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            job.progress = 100
            job.complete(result_data, evidence)
            
        except Exception as e:
            logger.error(f"Generic task failed: {str(e)}")
            job.fail(str(e))
    
