# ── Predictive Maintenance — Production Dockerfile ─────────────────────────
# Works on: Render, Hugging Face Spaces (Docker SDK), Railway, or any Docker host.
# Builds the React frontend, installs Python deps, and runs FastAPI as a single container.

FROM python:3.11-slim

# ── Install Node.js (for frontend build) ──────────────────────────────────
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies (cached layer) ────────────────────────────────────
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# ── Frontend build ────────────────────────────────────────────────────────
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --production=false

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ── Backend code + models + data ──────────────────────────────────────────
COPY backend/ ./backend/

# ── Environment ───────────────────────────────────────────────────────────
# PORT is set by the platform (Render, HF Spaces, etc.)
# HF Spaces uses 7860 by default; Render injects its own PORT.
ENV PORT=7860

EXPOSE 7860

# ── Start the server ──────────────────────────────────────────────────────
CMD cd backend && python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}
