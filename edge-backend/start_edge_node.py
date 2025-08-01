#!/usr/bin/env python3
"""
Start script for edge node simulators.
Usage: 
  uv run python start_edge_node.py --node-id node-01 --port 8001
  uv run python start_edge_node.py --node-id node-02 --port 8002
  uv run python start_edge_node.py --node-id node-03 --port 8003
"""

import os
import sys
import argparse
import uvicorn
from app.main import app

def main():
    parser = argparse.ArgumentParser(description="Start Edge Node Simulator")
    parser.add_argument("--node-id", default="node-01", help="Edge node identifier")
    parser.add_argument("--port", type=int, default=8001, help="Port to run on")
    parser.add_argument("--hostname", help="Node hostname")
    parser.add_argument("--os-type", choices=["windows", "linux", "macos"], help="Operating system type")
    parser.add_argument("--location", help="Node location (City, Country)")
    
    args = parser.parse_args()
    
    # Set environment variables based on arguments
    os.environ["EDGE_NODE_ID"] = args.node_id
    os.environ["PORT"] = str(args.port)
    
    # Predefined node configurations
    node_configs = {
        "node-01": {
            "hostname": "sec-node-01.corp.local",
            "ip": "10.1.100.15",
            "os_type": "windows",
            "os_version": "Windows Server 2019",
            "location_country": "United States",
            "location_city": "New York"
        },
        "node-02": {
            "hostname": "sec-node-02.corp.local", 
            "ip": "10.1.100.16",
            "os_type": "linux",
            "os_version": "Ubuntu 22.04 LTS",
            "location_country": "Germany",
            "location_city": "Frankfurt"
        },
        "node-03": {
            "hostname": "sec-node-03.corp.local",
            "ip": "10.1.100.17",
            "os_type": "macos",
            "os_version": "macOS 14.1",
            "location_country": "Japan",
            "location_city": "Tokyo"
        }
    }
    
    # Apply predefined config if available
    if args.node_id in node_configs:
        config = node_configs[args.node_id]
        os.environ["EDGE_NODE_HOSTNAME"] = args.hostname or config["hostname"]
        os.environ["EDGE_NODE_IP"] = config["ip"]
        os.environ["OS_TYPE"] = args.os_type or config["os_type"]
        os.environ["OS_VERSION"] = config["os_version"]
        os.environ["EDGE_NODE_LOCATION_COUNTRY"] = config["location_country"]
        os.environ["EDGE_NODE_LOCATION_CITY"] = config["location_city"]
    else:
        # Custom configuration
        os.environ["EDGE_NODE_HOSTNAME"] = args.hostname or f"custom-{args.node_id}.corp.local"
        os.environ["OS_TYPE"] = args.os_type or "linux"
    
    print(f"Starting Edge Node: {args.node_id}")
    print(f"Hostname: {os.getenv('EDGE_NODE_HOSTNAME')}")
    print(f"OS Type: {os.getenv('OS_TYPE')}")
    print(f"Port: {args.port}")
    print(f"Health Check: http://localhost:{args.port}/api/v1/health")
    
    # Start the server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=args.port,
        log_level="info",
        reload=True
    )

if __name__ == "__main__":
    main()