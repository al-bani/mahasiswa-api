# 🚀 Development Commands

## Production Mode (Perlu Build Ulang)

```bash
# Build ulang setiap ada perubahan
docker-compose down
docker-compose up --build -d

# Atau gunakan script
./docker-scripts.sh restart
make restart
```

## Development Mode (Hot Reload)

```bash
# Setup development environment
docker-compose -f docker-compose.dev-full.yml up -d

# Perubahan kode langsung ter-reflect!
# Tidak perlu restart container
```

## Quick Development Setup

```bash
# 1. Start development mode
docker-compose -f docker-compose.dev-full.yml up -d

# 2. Edit kode di VS Code
# 3. Lihat perubahan di http://localhost:3000

# 4. Jika perlu test production build:
docker-compose down
docker-compose up --build -d
```

## Database Access

```bash
# pgAdmin connection (development mode)
Host: localhost
Port: 5433
Database: mahasiswa_db
Username: postgres
Password: postgres123
```
