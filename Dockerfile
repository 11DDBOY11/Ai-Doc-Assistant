FROM python:3.10-slim

WORKDIR /app

# Install system dependencies in a single layer to minimize image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies with clean layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source, compiled frontend, and assets
COPY app/           ./app/
COPY sample_docs/   ./sample_docs/
COPY tests/         ./tests/
COPY frontend/dist/ ./frontend/dist/

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "8000"]
