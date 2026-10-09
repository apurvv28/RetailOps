#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y python3 python3-pip python3-venv git curl ufw

# Set up project directory
mkdir -p /home/ubuntu/RetailOps
chown -R ubuntu:ubuntu /home/ubuntu/RetailOps

echo "KrishiLoop initialization complete" > /var/log/krishiloop_init.log
