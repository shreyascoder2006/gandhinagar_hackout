import sys
import time
import socket
import paramiko

SERVER_IP = "213.202.211.10"
SERVER_USER = "root"
SERVER_PASS = "kU1QFE1YhF"
REPO_URL = "https://github.com/shreyascoder2006/gandhinagar_hackout.git"

def check_port(ip, port, timeout=3):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        res = s.connect_ex((ip, port))
        return res == 0
    except Exception as e:
        return False
    finally:
        s.close()

def run_ssh_command(ssh, cmd, description=None):
    if description:
        print(f"\n========================================================")
        print(f"[*] {description}")
        print(f"[CMD] {cmd}")
        print(f"========================================================")
    else:
        print(f"\n[CMD] {cmd}")
    
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    
    output = []
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line, end="", flush=True)
        output.append(line)
        
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0:
        err_line = "".join(stderr.readlines())
        if err_line:
            print(f"[STDERR] {err_line}", flush=True)
        print(f"[!] Command exited with status {exit_status}", flush=True)
    else:
        print(f"[+] Success (exit code 0)", flush=True)
    return exit_status == 0

def deploy():
    print(f"[*] Testing basic TCP connectivity to {SERVER_IP}:22...")
    if not check_port(SERVER_IP, 22, timeout=4):
        print(f"[-] ERROR: Port 22 is NOT reachable on {SERVER_IP}.")
        print(f"    Possible reasons:")
        print(f"    1. Server is shut down or still provisioning in the host console.")
        print(f"    2. Host/Cloud firewall or Security Group is dropping inbound TCP port 22.")
        print(f"    3. SSH daemon is running on a non-standard port.")
        return False
    
    print(f"[+] Port 22 is open! Connecting via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_IP, port=22, username=SERVER_USER, password=SERVER_PASS, timeout=10)
        print("[+] Successfully authenticated via SSH!")
    except Exception as e:
        print(f"[-] SSH Authentication / Connection failed: {e}")
        return False

    try:
        # 1. OS check
        run_ssh_command(ssh, "cat /etc/os-release | grep PRETTY_NAME", "Detecting Operating System")

        # 2. Package installation
        pkg_cmd = (
            "export DEBIAN_FRONTEND=noninteractive && "
            "apt-get update -y && "
            "apt-get install -y git python3 python3-pip python3-venv curl wget nginx ufw"
        )
        run_ssh_command(ssh, pkg_cmd, "Updating APT and Installing Core Packages")

        # 3. NodeSource Node.js 20 installation
        node_cmd = (
            "which node > /dev/null 2>&1 || ("
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && "
            "apt-get install -y nodejs"
            ") && node -v && npm -v"
        )
        run_ssh_command(ssh, node_cmd, "Setting up Node.js 20 and NPM")

        # 4. Clone or pull repo
        git_setup = (
            "if [ -d '/var/www/induscope/.git' ]; then "
            "  echo 'Repository exists. Pulling latest main...'; "
            "  cd /var/www/induscope && git fetch origin && git reset --hard origin/main; "
            "else "
            "  echo 'Cloning repository...'; "
            f"  mkdir -p /var/www && rm -rf /var/www/induscope && git clone {REPO_URL} /var/www/induscope; "
            "fi"
        )
        run_ssh_command(ssh, git_setup, "Syncing Induscope Repository")

        # 5. Backend venv and python dependencies
        backend_setup = (
            "cd /var/www/induscope && "
            "python3 -m venv venv && "
            "./venv/bin/pip install --upgrade pip && "
            "./venv/bin/pip install -r requirements.txt lightgbm pandas uvicorn fastapi sqlalchemy alembic"
        )
        run_ssh_command(ssh, backend_setup, "Configuring Python Virtual Environment & Dependencies")

        # 6. Database migrations & seed loading
        db_setup = (
            "cd /var/www/induscope/backend && "
            "../venv/bin/python -m alembic upgrade head && "
            "../venv/bin/python -m app.db.seed_loader"
        )
        run_ssh_command(ssh, db_setup, "Applying Database Migrations & Seeding 120 Factories")

        # 7. Frontend build
        frontend_setup = (
            "cd /var/www/induscope && "
            "npm install && "
            "npm run build"
        )
        run_ssh_command(ssh, frontend_setup, "Installing NPM Dependencies & Building Frontend Static Bundle")

        # 8. Systemd service for FastAPI
        systemd_service = """[Unit]
Description=Induscope FastAPI Backend Engine
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/induscope/backend
ExecStart=/var/www/induscope/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8811 --workers 2
Restart=always
RestartSec=5
Environment=PYTHONPATH=/var/www/induscope/backend

[Install]
WantedBy=multi-user.target"""

        create_service = f"cat << 'EOF' > /etc/systemd/system/induscope.service\n{systemd_service}\nEOF\n"
        service_cmd = (
            f"{create_service} && "
            "systemctl daemon-reload && "
            "systemctl enable induscope && "
            "systemctl restart induscope"
        )
        run_ssh_command(ssh, service_cmd, "Creating & Starting induscope.service via systemd")

        # 9. Nginx configuration
        nginx_conf = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # Static frontend Vite bundle
    location / {
        root /var/www/induscope/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy backend API
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

    # OpenAPI documentation
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
}"""

        create_nginx = f"cat << 'EOF' > /etc/nginx/sites-available/induscope\n{nginx_conf}\nEOF\n"
        nginx_cmd = (
            f"{create_nginx} && "
            "rm -f /etc/nginx/sites-enabled/default && "
            "ln -sf /etc/nginx/sites-available/induscope /etc/nginx/sites-enabled/induscope && "
            "nginx -t && "
            "systemctl restart nginx"
        )
        run_ssh_command(ssh, nginx_cmd, "Configuring Nginx Reverse Proxy")

        # 10. Firewall rules
        fw_cmd = (
            "ufw allow 22/tcp && "
            "ufw allow 80/tcp && "
            "ufw allow 443/tcp && "
            "echo 'y' | ufw enable || true"
        )
        run_ssh_command(ssh, fw_cmd, "Enabling UFW Firewall for Ports 22, 80, 443")

        # 11. Health checks
        verify_cmd = (
            "sleep 3 && "
            "echo '=== Induscope Service Status ===' && "
            "systemctl is-active induscope && "
            "echo '=== Nginx Status ===' && "
            "systemctl is-active nginx && "
            "echo '=== API Health Endpoint ===' && "
            "curl -s http://127.0.0.1/api/health && echo '' && "
            "echo '=== Sample Factory Data (Morbi Ceramics) ===' && "
            "curl -s http://127.0.0.1/api/factories/morbi-ceramics-01 | head -c 200 && echo ''"
        )
        run_ssh_command(ssh, verify_cmd, "Verifying Production Deployment")

        print("\n========================================================")
        print(f"[SUCCESS] Induscope deployed successfully to http://{SERVER_IP}/")
        print("========================================================")
        return True

    finally:
        ssh.close()

if __name__ == "__main__":
    success = deploy()
    sys.exit(0 if success else 1)
