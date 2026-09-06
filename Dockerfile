# Multi-stage build: Frontend Vite build + Python FastAPI on Cloud Run
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
COPY contracts ../contracts
RUN npm run build

FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    ENVIRONMENT=production \
    DEV_MODE=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast, reliable package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install Python backend dependencies
COPY backend/pyproject.toml backend/README.md ./
RUN uv pip install --system --no-cache -e .

# Copy backend application source
COPY backend/app ./app
COPY backend/app/data ./app/data

# Copy built frontend static assets
COPY --from=frontend-builder /app/dist /app/dist

# Security: Run as dedicated non-root application user
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

