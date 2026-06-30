
# Dockerfile for Devonn AI API
FROM python:3.14.3-slim

WORKDIR /app

# Install necessary system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Expose port the API will run on
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENV PYTHONPATH=/app/src

# Run the API server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
