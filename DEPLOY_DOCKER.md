# 🚀 How to Build, Push & Deploy Sovereign AI Workbench via Docker

Ye guide aapko batayegi ki aap pure project ke Docker images ko **Docker Hub** par kaise push karein taaki koi bhi user kisi bhi computer (Windows, Mac, Linux) par **bina Python ya Node install kiye, sirf 1 command se** pura setup chala sake.

---

## 1. Prerequisites (Pehle Ye Ready Rakhein)
1. **Docker Desktop** aapke computer par installed aur running hona chahiye.
2. Ek free account **[Docker Hub](https://hub.docker.com/)** par create kiya hua ho (jaise aapka username: `myuser123`).

---

## 2. Step-by-Step: Images Push Kaise Karein

### Step 1: Docker Hub Par Login Karein
Apne terminal (PowerShell ya Command Prompt) mein ye command run karein:
```powershell
docker login
```
Apna Docker Hub ka **Username** aur **Password/Personal Access Token** enter karein.

---

### Step 2: Images Ko Build Karein
Apna Docker Hub username environment variable mein set karein aur images build karein:

**On Windows PowerShell:**
```powershell
$env:DOCKER_USER="yourdockerhubusername"
docker compose build
```

**On Linux / Mac (Bash):**
```bash
export DOCKER_USER="yourdockerhubusername"
docker compose build
```
*(Yahan `yourdockerhubusername` ko apne actual Docker Hub username se replace karein).*

Ye command do optimized production images banayegi:
- `yourdockerhubusername/sovereign-backend:latest`
- `yourdockerhubusername/sovereign-frontend:latest`

---

### Step 3: Images Ko Docker Hub Par Push Karein
Ek single command se dono images Docker Hub registry par upload ho jayengi:

**On Windows PowerShell:**
```powershell
$env:DOCKER_USER="yourdockerhubusername"
docker compose push
```

**On Linux / Mac (Bash):**
```bash
export DOCKER_USER="yourdockerhubusername"
docker compose push
```

Upload complete hote hi aapke Docker Hub account par dono repositories public ho jayengi!

---

## 3. Koi Bhi Doosra User Isse Apne System Par Kaise Run Karega?

Kisi bhi doosre user (judge, evaluator, teammate) ko **koi coding setup ya dependencies install karne ki zaroorat nahi hai**.

Unhe bas ye **2 simple steps** karne hain:

### Step 1: `docker-compose.yml` Download Karein
Wo ek empty folder banayenge aur usme `docker-compose.yml` file save karenge (jismein `yourdockerhubusername` set hoga):

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: sovereign_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: sovereign_workbench
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: sovereign_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    image: yourdockerhubusername/sovereign-backend:latest
    container_name: sovereign_backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/sovereign_workbench
      REDIS_URL: redis://redis:6379/0
      ENVIRONMENT: production
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    volumes:
      - backend_data:/app/data

  frontend:
    image: yourdockerhubusername/sovereign-frontend:latest
    container_name: sovereign_frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
  backend_data:
```

### Step 2: Run Command
Wo usi folder mein terminal khol kar bas ye command chalayenge:
```bash
docker compose pull
docker compose up -d
```

### Result:
- Docker automatically charo containers (`postgres`, `redis`, `backend`, `frontend`) download karke start kar dega.
- Wo apne browser mein **`http://localhost:3000`** open karenge:
  - **Username**: `admin`
  - **Password**: `AdminPassword123!`
  - Pura Sovereign AI Workbench live chalne lagega!

---

## 4. Useful Management Commands
- **Logs check karne ke liye**:
  ```bash
  docker compose logs -f backend
  ```
- **Setup stop karne ke liye**:
  ```bash
  docker compose down
  ```
- **Fresh restart with clean data**:
  ```bash
  docker compose down -v
  docker compose up -d
  ```
