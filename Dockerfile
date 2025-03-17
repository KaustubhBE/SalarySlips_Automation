# Build frontend
FROM node:18 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Set production environment for frontend build
ENV NODE_ENV=production
ENV VITE_API_URL=/api
RUN npm run build

# Build backend
FROM python:3.10-slim
WORKDIR /app

# Configure apt to retry downloads and use multiple mirrors
RUN echo 'Acquire::Retries "3";' > /etc/apt/apt.conf.d/80-retries && \
    echo "deb http://cloudfront.debian.net/debian bookworm main" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian bookworm main" >> /etc/apt/sources.list

# Install system dependencies with retry logic
RUN apt-get update && \
    for i in {1..3}; do \
        apt-get install -y \
            build-essential \
            libreoffice \
            --no-install-recommends && break || \
        sleep 15; \
    done && \
    rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Create static directory for frontend
RUN mkdir -p /app/static

# Copy built frontend to static directory
COPY --from=frontend-builder /app/frontend/dist/* /app/static/

# Create directory for credentials
RUN mkdir -p /app/credentials

# Set environment variables
ENV FLASK_ENV=production
ENV STATIC_FOLDER=/app/static

# Expose port
EXPOSE 5000

# Command to run the application with worker timeout
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "120", "--workers", "3", "app:app"]