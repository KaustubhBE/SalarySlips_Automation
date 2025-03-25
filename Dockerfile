# Frontend build stage
FROM node:18 AS frontend-builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd frontend && npm install --legacy-peer-deps

# Copy source code
COPY frontend/ ./frontend/

# Build the frontend application
RUN cd frontend && npm run build

# Backend build stage
FROM ubuntu:22.04 AS backend-builder

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    software-properties-common \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Add LibreOffice repository
RUN add-apt-repository ppa:libreoffice/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    && rm -rf /var/lib/apt/lists/*

# Install Python and pip
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN python3 -m venv venv && . venv/bin/activate && pip install --no-cache-dir -r requirements.txt
RUN pip install flask
RUN pip install flask-cors

# Copy backend application code
COPY backend/ ./backend/

# Create output directory
RUN mkdir -p /app/Salary_Slips

# Final stage
FROM nginx:alpine

# Install Python and dependencies in the final stage
RUN apk add --no-cache python3 py3-pip

# Set working directory
WORKDIR /app

# Copy virtual environment from backend-builder stage
COPY --from=backend-builder /app/venv /app/venv

# Copy built frontend assets from frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy backend application code from backend-builder stage
COPY --from=backend-builder /app/backend /app/backend

# Expose ports
EXPOSE 80 5000

# Start nginx and backend application
CMD ["sh", "-c", "nginx -g 'daemon off;' & . /app/venv/bin/activate && python3 /app/backend/app.py"]