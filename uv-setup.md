# UV Setup Guide

This project uses [uv](https://github.com/astral-sh/uv) for fast Python package management. Follow this guide to set up your development environment.

## Installing uv

### macOS/Linux
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Windows
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Alternative (via pip)
```bash
pip install uv
```

## Project Setup

### 1. Clone and Setup
```bash
git clone <repository>
cd 25-panw-rnd-hackathon

# Install dependencies for both backend services
cd backend && uv sync && cd ..
cd edge-backend && uv sync && cd ..
```

### 2. Google AI Setup

Authenticate with Google Cloud:

```bash
# Install gcloud CLI if not already installed
# https://cloud.google.com/sdk/docs/install

# Authenticate (required)
gcloud auth application-default login
```

### 3. Start Services
```bash
# Start all services at once
./start_all_services.sh

# Or start individually
cd backend
uv run python start_server.py

# In another terminal
cd edge-backend
uv run python start_edge_node.py --node-id node-01 --port 8001
```

## uv Commands Reference

### Dependency Management
```bash
# Install dependencies from pyproject.toml
uv sync

# Add a new dependency
uv add fastapi

# Add a development dependency
uv add --dev pytest

# Remove a dependency
uv remove package-name

# Update all dependencies
uv lock --upgrade
```

### Running Code
```bash
# Run Python scripts
uv run python script.py

# Run with specific arguments
uv run python start_edge_node.py --node-id node-02 --port 8002

# Run tests
uv run pytest

# Run with environment variables
DATABASE_URL=custom_db uv run python start_server.py
```

### Virtual Environment
```bash
# uv automatically manages virtual environments
# But you can also create/activate manually if needed

# Create venv
uv venv

# Activate (if needed for IDE integration)
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows
```

## Why uv?

- **Speed**: 10-100x faster than pip
- **Reliability**: Better dependency resolution
- **Simplicity**: Single tool for packages and environments
- **Compatibility**: Works with existing pip/PyPI ecosystem

## Project Structure with uv

```
backend/
├── pyproject.toml    # Dependencies and project config
├── uv.lock          # Locked dependency versions
├── app/             # Application code
└── start_server.py  # Entry point

edge-backend/
├── pyproject.toml    # Dependencies and project config
├── uv.lock          # Locked dependency versions  
├── app/             # Application code
└── start_edge_node.py # Entry point
```

## Troubleshooting

### uv not found
```bash
# Make sure uv is in your PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Or restart your shell
exec $SHELL
```

### Permission errors
```bash
# On some systems, you might need to make scripts executable
chmod +x start_all_services.sh
```

### Lock file conflicts
```bash
# If you get lock file conflicts, regenerate:
uv lock --upgrade
```

## Migration from pip/venv

If you were previously using pip and virtual environments:

1. **Dependencies**: `requirements.txt` → `pyproject.toml`
2. **Environment**: `python -m venv` → `uv venv` (automatic)
3. **Install**: `pip install -r requirements.txt` → `uv sync`
4. **Run**: `python script.py` → `uv run python script.py`

The transition is seamless - uv understands existing requirements.txt files and can generate pyproject.toml files automatically.