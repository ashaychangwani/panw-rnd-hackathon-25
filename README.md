# panw-rnd-hackathon-25
# Threat Hunting Agent (LLM + MCP)

This project implements an **iterative threat hunting agent** powered by LLM and Model Context Protocol (MCP).

## Features
- Extract IOCs from threat intel blogs
- Query local log & PCAP files via MCP server
- Iterative pivoting guided by LLM
- Builds attack timeline, MITRE mapping, and affected assets
- Generates JSON, HTML, and PDF hunt reports

## Installation
```bash
git clone <repo>
cd threat_hunting_agent
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
