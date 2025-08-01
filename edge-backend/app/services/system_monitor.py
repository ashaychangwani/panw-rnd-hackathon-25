import psutil
import asyncio
import logging
from typing import Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SystemMonitor:
    """Service to monitor system resource utilization"""
    
    def __init__(self):
        self._last_network_stats = None
        self._last_network_time = None
        
    def get_cpu_utilization(self) -> float:
        """Get current CPU utilization as percentage"""
        try:
            # Get CPU utilization over a short interval for accuracy
            return psutil.cpu_percent(interval=0.1)
        except Exception as e:
            logger.error(f"Error getting CPU utilization: {e}")
            return 0.0
    
    def get_memory_utilization(self) -> float:
        """Get current memory utilization as percentage"""
        try:
            memory = psutil.virtual_memory()
            return memory.percent
        except Exception as e:
            logger.error(f"Error getting memory utilization: {e}")
            return 0.0
    
    def get_disk_utilization(self) -> float:
        """Get current disk utilization as percentage"""
        try:
            disk = psutil.disk_usage('/')
            return (disk.used / disk.total) * 100
        except Exception as e:
            logger.error(f"Error getting disk utilization: {e}")
            return 0.0
    
    async def get_network_utilization(self) -> float:
        """Get network utilization as percentage of total bandwidth"""
        try:
            current_stats = psutil.net_io_counters()
            current_time = datetime.now()
            
            if self._last_network_stats is None:
                self._last_network_stats = current_stats
                self._last_network_time = current_time
                # Wait a second to get initial reading
                await asyncio.sleep(1)
                return await self.get_network_utilization()
            
            # Calculate bytes per second
            time_delta = (current_time - self._last_network_time).total_seconds()
            if time_delta == 0:
                return 0.0
                
            bytes_sent_per_sec = (current_stats.bytes_sent - self._last_network_stats.bytes_sent) / time_delta
            bytes_recv_per_sec = (current_stats.bytes_recv - self._last_network_stats.bytes_recv) / time_delta
            
            # Total network throughput in bytes per second
            total_throughput = bytes_sent_per_sec + bytes_recv_per_sec
            
            # Estimate as percentage of a typical 1 Gbps connection (125 MB/s)
            # This is a rough estimation - in production you'd want to detect actual link speed
            max_bandwidth = 125 * 1024 * 1024  # 1 Gbps in bytes per second
            utilization = min((total_throughput / max_bandwidth) * 100, 100.0)
            
            # Update last stats
            self._last_network_stats = current_stats
            self._last_network_time = current_time
            
            return utilization
            
        except Exception as e:
            logger.error(f"Error getting network utilization: {e}")
            return 0.0
    
    async def get_all_resources(self) -> Dict[str, float]:
        """Get all resource utilization metrics"""
        try:
            # Get CPU and memory synchronously (they're fast)
            cpu = self.get_cpu_utilization()
            memory = self.get_memory_utilization()
            disk = self.get_disk_utilization()
            
            # Get network utilization asynchronously (requires measurement over time)
            network = await self.get_network_utilization()
            
            return {
                "cpu": round(cpu, 1),
                "memory": round(memory, 1),
                "network": round(network, 1),
                "disk": round(disk, 1)
            }
        except Exception as e:
            logger.error(f"Error getting resource utilization: {e}")
            return {
                "cpu": 0.0,
                "memory": 0.0,
                "network": 0.0,
                "disk": 0.0
            }
    
    def get_system_info(self) -> Dict[str, any]:
        """Get additional system information"""
        try:
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime = datetime.now() - boot_time
            
            return {
                "uptime_seconds": int(uptime.total_seconds()),
                "boot_time": boot_time.isoformat(),
                "cpu_count": psutil.cpu_count(),
                "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
                "disk_total_gb": round(psutil.disk_usage('/').total / (1024**3), 2)
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            return {}