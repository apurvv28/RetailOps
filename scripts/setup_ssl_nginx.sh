#!/usr/bin/env bash
set -e

sudo rm -f /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx for 13.201.53.237.nip.io proxying to localhost:8000
sudo tee /etc/nginx/sites-available/krishiloop << 'EOF'
server {
    listen 80;
    server_name 13.201.53.237.nip.io;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/krishiloop /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Request Let's Encrypt SSL certificate non-interactively
sudo certbot --nginx -d 13.201.53.237.nip.io --non-interactive --agree-tos -m apurvsaktepar2006@gmail.com || true

sudo systemctl reload nginx
echo "=== Nginx HTTPS Setup Completed ==="
