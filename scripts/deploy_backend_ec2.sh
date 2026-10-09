#!/usr/bin/env bash
# ====================================================================
# KrishiLoop Backend Deployment Script for EC2 (ALB Target Group)
# ====================================================================
set -e

APP_DIR="/home/ubuntu/Course-Project-RetailOps"
if [ ! -d "$APP_DIR" ]; then
  APP_DIR="/home/ec2-user/Course-Project-RetailOps"
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Cloning repository to /home/ubuntu/Course-Project-RetailOps..."
  git clone https://github.com/apurvv28/RetailOps.git /home/ubuntu/Course-Project-RetailOps
  APP_DIR="/home/ubuntu/Course-Project-RetailOps"
fi

echo "Deploying KrishiLoop Backend on EC2: $APP_DIR"
cd "$APP_DIR"

# 1. Fetch latest commits from GitHub
echo "Pulling latest code from origin/main..."
git fetch origin main
git reset --hard origin/main

# 2. Virtual Environment setup
if [ ! -d "backend/.venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv backend/.venv
fi

source backend/.venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 3. Verify Database
python3 backend/schema/init_db.py

# 4. Restart Systemd Service or Docker Container
if systemctl is-active --quiet krishiloop-backend; then
  echo "Restarting krishiloop-backend systemd service..."
  sudo systemctl restart krishiloop-backend
elif command -v docker &> /dev/null && docker ps | grep -q "krishiloop-backend"; then
  echo "Restarting Docker container..."
  docker compose up -d --build backend
else
  echo "Restarting FastAPI service..."
  pkill -f "uvicorn backend.app.main:app" || true
  nohup backend/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 > /var/log/krishiloop_backend.log 2>&1 &
fi

# 5. Wait and Verify Health on Target Group Port (8000)
echo "Checking health endpoint on Target Group port 8000..."
sleep 5
for i in {1..10}; do
  if curl -sf http://localhost:8000/health > /dev/null; then
    echo "KrishiLoop Backend is HEALTHY on port 8000!"
    exit 0
  fi
  echo "Waiting for backend to respond ($i/10)..."
  sleep 2
done

echo "Health check failed on localhost:8000!"
exit 1
