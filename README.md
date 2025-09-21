# Artzooka

A real-time social drawing game.

Backend: Spring Boot (Java 17, Gradle, WebSocket/STOMP, JPA, Flyway, PostgreSQL).
Frontend: React + Vite + TypeScript, Zustand, SockJS + @stomp/stompjs.

This guide describes production deployment on AWS using one EC2 instance (app + web) and an Amazon RDS for PostgreSQL instance.

## Architecture
- Nginx on EC2 serves the built React app and reverse-proxies API and WebSocket to Spring Boot
- Spring Boot runs as a systemd service on the same EC2 (port 8080)
- RDS PostgreSQL stores game data; Flyway runs on app startup
- Uploaded drawings live on EC2 local disk under `uploads/` and are served by the backend at `/static/**`

## Prerequisites
- AWS account and permissions for EC2 + RDS
- Domain (optional, recommended) pointing to EC2 public IP (A record)
- AMI: Ubuntu 22.04 LTS (or similar)
- Security groups:
  - EC2: inbound 80, 443 (TCP) from 0.0.0.0/0; allow outbound to RDS on 5432
  - RDS: inbound 5432 from the EC2 security group

## 1) Create PostgreSQL RDS
1. Engine: PostgreSQL 15+
2. Create DB `artzooka`, note username/password
3. Publicly accessible: No
4. Security group: allow ingress from EC2 SG

## 2) Provision EC2 and install deps
SSH to EC2 and run:
```bash
sudo apt update && sudo apt install -y openjdk-17-jdk nginx git curl unzip
# Node (for building the frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3) Clone and build
```bash
sudo mkdir -p /opt/artzooka && sudo chown -R $USER:$USER /opt/artzooka
cd /opt/artzooka
git clone https://github.com/abhaskarchary/project-artzooka.git .

# Backend
cd backend
./gradlew bootJar
ls build/libs/*.jar

# Frontend
cd ../frontend
npm ci
# Build with same-origin API (recommended behind nginx proxy)
VITE_API_BASE= npm run build
```

## 4) Spring Boot as systemd
Create `/etc/systemd/system/artzooka.service`:
```ini
[Unit]
Description=Artzooka Spring Boot Service
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/artzooka/backend
Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://<RDS_ENDPOINT>:5432/artzooka
Environment=SPRING_DATASOURCE_USERNAME=<db_user>
Environment=SPRING_DATASOURCE_PASSWORD=<db_password>
Environment=SERVER_PORT=8080
ExecStart=/usr/bin/java -jar /opt/artzooka/backend/build/libs/*.jar
Restart=always
RestartSec=5
ReadWritePaths=/opt/artzooka/backend/uploads

[Install]
WantedBy=multi-user.target
```
Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable artzooka
sudo systemctl start artzooka
sudo systemctl status artzooka -n 50
```
Health: `curl http://localhost:8080/actuator/health`.

## 5) Frontend under Nginx
```bash
sudo mkdir -p /var/www/artzooka
sudo cp -r /opt/artzooka/frontend/dist/* /var/www/artzooka/
```

## 6) Nginx reverse proxy (web + API + WS)
Create `/etc/nginx/sites-available/artzooka`:
```nginx
server {
    listen 80;
    server_name _;  # replace with your domain

    root /var/www/artzooka;
    index index.html;

    location / { try_files $uri /index.html; }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/artzooka /etc/nginx/sites-enabled/artzooka
sudo nginx -t && sudo systemctl reload nginx
```
TLS (Let’s Encrypt):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

## 7) Uploads directory permissions
```bash
sudo mkdir -p /opt/artzooka/backend/uploads
sudo chown -R www-data:www-data /opt/artzooka/backend/uploads
```

## 8) Environment variables
- `SPRING_DATASOURCE_URL` e.g. `jdbc:postgresql://<RDS_ENDPOINT>:5432/artzooka`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SERVER_PORT` (default 8080)

Frontend:
- `VITE_API_BASE` — set empty for same-origin proxy during build: `VITE_API_BASE= npm run build`

## 9) Smoke test
```bash
curl -s -X GET http://YOUR_DOMAIN/actuator/health | jq
ROOM=$(curl -s -X POST http://YOUR_DOMAIN/api/rooms | jq -r .code)
for n in Alice Bob Charlie; do
  curl -s -X POST http://YOUR_DOMAIN/api/rooms/$ROOM/join -H 'Content-Type: application/json' -d "{\"name\":\"$n\"}" | jq
done
curl -s -X POST http://YOUR_DOMAIN/api/rooms/$ROOM/start | jq
```

## 10) Update deployment
```bash
cd /opt/artzooka
sudo -u www-data git pull
cd backend && sudo -u www-data ./gradlew bootJar && sudo systemctl restart artzooka
cd ../frontend && npm ci && VITE_API_BASE= npm run build
sudo rsync -a --delete dist/ /var/www/artzooka/
sudo systemctl reload nginx
```

## Troubleshooting
- WebSocket fails: ensure `/ws` proxy with upgrade headers and SG allows 80/443
- Images missing: check permissions on `/opt/artzooka/backend/uploads` and returned `/static/...` URLs
- Browser requests hang locally: hard reload/clear site data; ensure `VITE_API_BASE` empty for same-origin proxy

---

Repo: https://github.com/abhaskarchary/project-artzooka.git
