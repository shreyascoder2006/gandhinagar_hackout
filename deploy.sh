#!/usr/bin/env bash
# ==============================================================================
# Induscope One-Click Linux VPS Deployment Script
# Target: Ubuntu / Debian Server
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo " Starting Induscope Production Deployment"
echo "========================================================"

APP_DIR="/var/www/induscope"
REPO_URL="https://github.com/shreyascoder2006/gandhinagar_hackout.git"

# 1. Update system packages
echo "[1/8] Updating package index and installing base dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git python3 python3-pip python3-venv curl wget nginx ufw

# 2. Install Node.js 20 LTS if not present
echo "[2/8] Ensuring Node.js 20 LTS is installed..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Clone or pull repository
echo "[3/8] Syncing Induscope codebase..."
if [ -d "$APP_DIR/.git" ]; then
    echo "Existing repository found in $APP_DIR. Pulling latest code..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "Cloning Induscope repository to $APP_DIR..."
    mkdir -p /var/www
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
fi

# 4. Set up Python Virtual Environment & Backend dependencies
echo "[4/8] Configuring Python venv and backend dependencies..."
cd "$APP_DIR"
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt lightgbm pandas uvicorn fastapi sqlalchemy alembic

# 5. Database migrations and seeding
echo "[5/8] Running database migrations & seeding 120 factories..."
cd "$APP_DIR/backend"
../venv/bin/python -m alembic upgrade head
../venv/bin/python -m app.db.seed_loader

# 6. Build Frontend Static Assets
echo "[6/8] Installing NPM packages and compiling Vite production bundle..."
cd "$APP_DIR"
npm install
npm run build

# 7. Setup systemd unit service for FastAPI backend
echo "[7/8] Configuring systemd service (induscope.service)..."
cat << 'EOF' > /etc/systemd/system/induscope.service
[Unit]
Description=Induscope FastAPI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/induscope/backend
ExecStart=/var/www/induscope/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8811 --workers 2
Restart=always
RestartSec=5
Environment=PYTHONPATH=/var/www/induscope/backend

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable induscope
systemctl restart induscope

# 8. Setup Nginx Reverse Proxy
echo "[8/8] Configuring Nginx reverse proxy..."
cat << 'EOF' > /etc/nginx/sites-available/induscope
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # Static Vite build
    location / {
        root /var/www/induscope/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:8811/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger / OpenAPI documentation
    location /docs {
        proxy_pass http://127.0.0.1:8811/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8811/openapi.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/induscope /etc/nginx/sites-enabled/induscope
nginx -t
systemctl restart nginx

# Firewall rules
echo "Ensuring firewall allows SSH (22), HTTP (80), and HTTPS (443)..."
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
echo "y" | ufw enable || true

# Verification
sleep 3
echo "========================================================"
echo " Verification Status"
echo "========================================================"
systemctl is-active induscope && echo "[+] Backend Service: ACTIVE" || echo "[-] Backend Service: FAILED"
systemctl is-active nginx && echo "[+] Nginx Proxy: ACTIVE" || echo "[-] Nginx Proxy: FAILED"
echo "[+] API Health Response:"
curl -s http://127.0.0.1/api/health || true
echo ""
echo "========================================================"
echo " Induscope is now LIVE!"
echo " Access URL: http://$(curl -s https://api.ipify.org || echo 'YOUR_SERVER_IP')/"
echo " API Docs:   http://$(curl -s https://api.ipify.org || echo 'YOUR_SERVER_IP')/docs"
echo "========================================================"
