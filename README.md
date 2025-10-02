# Artzooka

A real-time social drawing game.

Backend: Spring Boot (Java 17, Gradle, WebSocket/STOMP, JPA, Flyway, PostgreSQL).
Frontend: React + Vite + TypeScript, Zustand, SockJS + @stomp/stompjs.

## Quick Start with Docker Compose

The easiest way to run Artzooka locally or in production is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/abhaskarchary/project-artzooka.git
cd project-artzooka

# Option 1: Use the convenience script
./start.sh

# Option 2: Use Docker Compose directly
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

The application will be available at:
- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:8080
- **PostgreSQL**: localhost:5432

### Docker Compose Services

- **postgres**: PostgreSQL 16 database with persistent data
- **backend**: Spring Boot application with health checks
- **frontend**: React app served by Nginx with API/WebSocket proxy

### Environment Variables

You can customize the setup by creating a `.env` file:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=root
POSTGRES_DB=artzooka

# Backend
SERVER_PORT=8080
```

### Production Deployment

For production deployment, use the production override:

```bash
# Set a strong database password
export POSTGRES_PASSWORD="your_secure_password_here"

# Start with production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The production configuration includes:
- **Security**: Database not exposed externally, backend only accessible via frontend proxy
- **Restart policies**: Services automatically restart on failure
- **Resource limits**: Memory and CPU limits for better resource management
- **Logging**: Reduced log verbosity for production

Additional production considerations:

1. **Use external database**: Comment out the postgres service and update `SPRING_DATASOURCE_URL`
2. **Add SSL/TLS**: Configure Nginx with certificates or use a reverse proxy like Traefik
3. **Scale services**: Use `docker-compose up --scale backend=3`
4. **Persistent uploads**: Ensure the uploads volume is backed up
5. **Monitoring**: Add health check endpoints and monitoring tools
6. **Secrets management**: Use Docker secrets or external secret management

### Smoke Test (Docker)

Once the services are running, test the application:

```bash
# Check service health
docker-compose ps

# Test backend health endpoint
curl -s http://localhost:8080/actuator/health | jq

# Test full application flow
ROOM=$(curl -s -X POST http://localhost/api/rooms | jq -r .code)
for n in Alice Bob Charlie; do
  curl -s -X POST http://localhost/api/rooms/$ROOM/join \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$n\"}" | jq
done
curl -s -X POST http://localhost/api/rooms/$ROOM/start | jq
```

### Troubleshooting Docker Setup

- **Services won't start**: Check `docker-compose logs` for errors
- **Database connection issues**: Ensure PostgreSQL is healthy before backend starts
- **Frontend can't reach backend**: Verify Nginx proxy configuration
- **Port conflicts**: Change ports in docker-compose.yml if 80/8080/5432 are in use

---

## Manual Deployment (Alternative)

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

## Integration Testing

Artzooka includes a comprehensive integration testing framework that tests the complete game flow using browser automation.

### Quick Start

```bash
# Start the application
docker-compose up -d

# Run integration tests
./test.sh

# Run tests with visible browser (development)
./test.sh dev

# Clean up test containers
./test.sh clean
```

### Test Framework Features

- **Browser Automation**: Uses Playwright for real end-to-end testing
- **Gherkin Syntax**: Tests written in plain text using Given/When/Then format
- **Docker Integration**: Tests run in isolated containers
- **Fast Execution**: Configurable short timers for quick test runs
- **Visual Debugging**: Screenshots on test failures
- **Parallel Execution**: Multiple browser contexts for multi-player scenarios

### Writing Tests

Tests are written in plain text using Gherkin syntax in the `integrationTests/tests/` directory:

```gherkin
SCENARIO: All Players submit drawing before timer expires
GIVEN: 3 players are needed
WHEN: Player1 creates a room
AND: Player2 joins the room
AND: Player3 joins the room
AND: Player1 starts the game
AND: Player1 submits drawing
AND: Player2 submits drawing
AND: Player3 submits drawing
THEN: All players must be taken to Discussion Screen
```

### Available Actions

- **Setup**: `3 players are needed`, `Player1 creates a room`
- **Game Flow**: `joins room`, `starts game`, `submits drawing`, `votes`
- **Timing**: `drawing timer expires`, `voting timer expires`
- **Verification**: `taken to Discussion Screen`, `shown in voting screen`

### Test Configuration

The framework supports various configuration options:

```bash
# Run with custom timers
npm test -- --draw-time 3 --vote-time 3

# Run with slow motion for debugging
npm test -- --headed --slow-mo 1000

# Run specific test file
npm test tests/draw-flow.txt
```

### CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Integration Tests
  run: |
    docker-compose up -d
    ./test.sh
    docker-compose down
```

---

Repo: https://github.com/abhaskarchary/project-artzooka.git
