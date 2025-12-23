# Rote Self-hosted Deployment Guide

This guide helps you quickly deploy your own Rote instance.  
We recommend using Docker for deployment.

---

## 1. Quick Start

Rote provides two main deployment methods. Choose the one that best fits your needs.

### Method 1: Use Docker Hub Image

This is the most common and general way to deploy Rote.

1. **Prepare configuration file**

   Copy the [**docker-compose.yml**](https://github.com/Rabithua/Rote/blob/main/docker-compose.yml) file from the project to your server.

2. **Set environment variables and start services**

   You can pass environment variables directly when running `docker-compose`.  
   Remember to replace `ip` and `password` before running:

   ```bash
   # Use latest image (default)
   VITE_API_BASE=http://<your-ip-address>:18000 \
   POSTGRES_PASSWORD=your-secure-password \
   IMAGE_TAG=latest \
   docker-compose up -d

   # Use a specific version (for example v1.0.0)
   VITE_API_BASE=http://<your-ip-address>:18000 \
   POSTGRES_PASSWORD=your-secure-password \
   IMAGE_TAG=v1.0.0 \
   docker-compose up -d
   ```

   After startup:
   - Backend default: `http://<your-ip-address>:18000`
   - Frontend default: `http://<your-ip-address>:18001`

### Method 2: Use Dokploy (Recommended)

Dokploy is an open-source Docker deployment platform with a visual UI.

1. **Open Dokploy**

   Open your Dokploy dashboard in the browser.

2. **Deploy from template**

   `Create Service` -> `Template` -> search `Rote` -> `Create`

3. **Configure custom domain (optional)**
   - By default, Dokploy will generate a domain for you.
   - If you want to use your own domain, remember to update the environment variable:

     ```bash
     VITE_API_BASE=http://your-domain.com
     # or
     VITE_API_BASE=https://your-domain.com
     ```

---

## 2. Configuration

Rote is configured via environment variables.

### 1. Required configuration

- **VITE_API_BASE**  
  The API base URL used by the frontend.  
  It must match your actual backend address, for example:

  ```bash
  VITE_API_BASE=http://your-ip-address:18000
  VITE_API_BASE=https://your-domain.com
  ```

### 2. Optional configuration

- **POSTGRES_PASSWORD**  
  PostgreSQL database password.  
  Default: `rote_password_123` (you **must** change this in production).

- **IMAGE_TAG**  
  Docker image tag (default: `latest`), for example:

  ```bash
  IMAGE_TAG=v1.0.0
  ```

### 3. Advanced configuration

More options (OAuth, file storage, mail service, etc.) can be configured in the admin UI after deployment.  
On first launch, Rote will show an initialization wizard where you can complete the detailed setup.

---

## 3. Service Ports

By default, Rote uses the following ports:

- **18000** – Backend API
- **18001** – Frontend web
- **5432** – PostgreSQL (inside container, not exposed publicly)

If you want to change ports, edit the `ports` section in `docker-compose.yml`.

---

## 4. Backup & Migration

Rote uses Docker volumes for data, which makes backup and migration straightforward.

### 1. Backup

#### 1.1 Backup database

Run on the host:

```bash
# Export database
docker exec rote-postgres pg_dump -U rote rote > rote_backup_$(date +%Y%m%d).sql
```

#### 1.2 Backup file storage

If you use cloud storage (S3 / R2), please follow your provider’s backup guide.

---

### 2. Migration

#### 2.1 Deploy Rote on the new server

Deploy a fresh Rote instance on the new server by following the “Quick Start” section.

#### 2.2 Restore database

Upload the backup file to the new server and run:

```bash
# Import database
docker exec -i rote-postgres psql -U rote rote < rote_backup_YYYYMMDD.sql
```

#### 2.3 Migrate file storage

If you use S3 / R2, usually no extra migration is needed as long as you use the same bucket and credentials.

---

## 5. FAQ

### 1. Services failed to start

- **Check ports**  
  Make sure ports `18000` and `18001` are not occupied by other processes.

- **Check Docker**
  - `docker ps` – check if containers are running
  - `docker logs rote-backend` – check backend logs
  - `docker logs rote-postgres` – check database logs

- **Check environment variables**  
  Ensure `VITE_API_BASE` and other variables are correctly set.

### 2. Frontend cannot reach backend

- **Check VITE_API_BASE**  
  Make sure the configured backend URL is accessible in the browser.

- **Check network / reverse proxy**  
  If you use Nginx / Caddy, ensure the proxy configuration is correct.

- **Check firewall**  
  Make sure your firewall allows access on the relevant ports (80 / 443 / 18000 / 18001).

### 3. Database connection failed

- **Check database container**  
  Use `docker logs rote-postgres` to see if PostgreSQL started correctly.

- **Check connection string**  
  Ensure username, password, host, port, and database name are all correct.

- **Wait for initialization**  
  On first launch, PostgreSQL may take some time to initialize; the backend might temporarily fail to connect.

### 4. How to upgrade Rote

1. **Backup data**  
   Follow the “Backup” section above.

2. **Pull new image**

   ```bash
   # Pull latest image
   docker-compose pull

   # Or pull a specific version
   IMAGE_TAG=v1.0.0 docker-compose pull
   ```

3. **Restart services**

   ```bash
   docker-compose up -d
   ```

---

## 6. Getting Help

If you run into problems during deployment:

- **GitHub Issues:** https://github.com/rabithua/rote/issues
- **Security vulnerabilities (high severity):** rabithua@gmail.com
