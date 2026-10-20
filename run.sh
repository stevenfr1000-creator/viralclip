#!/bin/bash
# Start the ViralClip backend with the verified real path.
cd "$(dirname "$0")"
export PYTHONPATH=.
echo "Starting ViralClip API on :8000"
echo "Health: http://localhost:8000/api/v1/health"
uvicorn main:app --host 0.0.0.0 --port 8000
