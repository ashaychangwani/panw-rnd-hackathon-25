# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    pkg-config \
    libssl-dev \
    libffi-dev \
    tshark \
    tcpdump \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml for dependency installation
COPY pyproject.toml .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi \
    uvicorn[standard]==0.24.0 \
    pydantic==2.5.0 \
    pydantic-settings==2.1.0 \
    python-multipart==0.0.6 \
    python-dotenv==1.0.0 \
    aiofiles==23.2.1 \
    httpx>=0.28.1 \
    colorlog>=6.8.0 \
    websockets>=13.0 \
    sqlalchemy==2.0.23 \
    asyncpg==0.29.0 \
    psycopg2-binary==2.9.9 \
    alembic==1.13.0 \
    python-jose[cryptography]==3.3.0 \
    google-genai==1.28.0 \
    beautifulsoup4==4.12.2 \
    psutil>=5.9.0 \
    pyshark

# Copy edge-backend source code
COPY edge-backend/ ./edge-backend/

# Create log directory and copy log files from host /etc/log to container /log
RUN mkdir -p /log
COPY /etc/log/ /log/

# Set environment variables
ENV PYTHONPATH=/app
ENV EDGE_NODE_ID=node-01
ENV EDGE_NODE_HOSTNAME=sec-node-01.corp.local
ENV EDGE_NODE_IP=10.1.100.15
ENV OS_TYPE=linux
ENV OS_VERSION="Ubuntu 22.04 LTS"
ENV EDGE_NODE_LOCATION_COUNTRY="United States"
ENV EDGE_NODE_LOCATION_CITY="New York"
ENV PORT=8001

# Expose the port
EXPOSE 8001

# Set the working directory to edge-backend
WORKDIR /app/edge-backend

# Run the edge node
CMD ["python", "start_edge_node.py", "--node-id", "node-01", "--port", "8001"]