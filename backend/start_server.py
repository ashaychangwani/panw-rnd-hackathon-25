#!/usr/bin/env python3
"""
Start script for the control server.
Usage: uv run python start_server.py
"""

import os
import sys
import uvicorn
from app.main import app

def main():
    # Set default environment variables if not set
    os.environ.setdefault("HOST", "0.0.0.0")
    os.environ.setdefault("PORT", "8000")
    os.environ.setdefault("LOG_LEVEL", "INFO")
    
    print("Starting Threat Hunting Control Server...")
    print("Using gcloud authentication for Google AI services")
    print(f"Server will be available at: http://{os.getenv('HOST')}:{os.getenv('PORT')}")
    print(f"API Documentation: http://{os.getenv('HOST')}:{os.getenv('PORT')}/docs")
    
    # Start the server
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST"),
        port=int(os.getenv("PORT")),
        log_level=os.getenv("LOG_LEVEL").lower(),
        reload=True
    )

if __name__ == "__main__":
    main()