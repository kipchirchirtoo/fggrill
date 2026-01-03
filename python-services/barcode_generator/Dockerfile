FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including fonts for barcode generation
RUN apt-get update && apt-get install -y \
    curl \
    fonts-dejavu-core \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5003/health || exit 1

# Run the application
CMD ["python", "app.py"]
