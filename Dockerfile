# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend configuration files
COPY frontend/package*.json ./
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ ./
COPY contracts/ ../contracts/

# Set the API URL to be relative so it points to the backend it's served from
ENV VITE_API_BASE_URL=/api/v1

# Build the frontend (outputs to /app/frontend/dist)
RUN npm run build

# ==========================================
# Stage 2: Build the FastAPI Backend
# ==========================================
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast python package manager)
RUN pip install uv

# Copy python dependency definitions
COPY backend/pyproject.toml backend/uv.lock ./

# Install python dependencies system-wide (no virtual env needed in container)
RUN uv pip install --system -r pyproject.toml

# Copy backend source code
COPY backend/app/ ./app/

# Copy the built React UI from Stage 1 into the backend's static folder!
COPY --from=frontend-builder /app/dist /app/static/

# Set environment variables for production
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose the Cloud Run port
EXPOSE 8080

# Start the FastAPI server using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

