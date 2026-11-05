FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and benchmark documents
COPY app/ ./app/
COPY sample_docs/ ./sample_docs/
COPY tests/ ./tests/

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "8000"]
