#!/usr/bin/env bash
# ====================================================================
# KrishiLoop EC2 One-Time Setup Script: Systemd Service + Weekly Cron
# ====================================================================
set -e

APP_DIR="/home/ubuntu/Course-Project-RetailOps"

echo "Configuring systemd service for KrishiLoop FastAPI backend..."

sudo bash -c "cat << 'EOF' > /etc/systemd/system/krishiloop-backend.service
[Unit]
Description=KrishiLoop Intelligence Backend (FastAPI + MLOps)
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/backend/.env
Environment=AWS_PROFILE=krishiloop
Environment=AWS_DEFAULT_REGION=ap-south-1
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=append:/var/log/krishiloop_backend.log
StandardError=append:/var/log/krishiloop_backend_err.log

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable krishiloop-backend
sudo systemctl restart krishiloop-backend

echo "Configuring Weekly Sunday 06:00 AM SageMaker Retraining Cron..."
crontab $APP_DIR/scripts/crontab.txt

echo "Setup complete! Backend is running as a systemd service on port 8000 connected to ALB Target Group."
