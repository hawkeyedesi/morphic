#!/bin/bash

# Script to start services for advanced file processing

echo "Starting required services for advanced file processing..."

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Check if Redis and Qdrant containers are running
echo "Checking for required services..."

# Start Redis and Qdrant if not running
if ! docker ps | grep -q "redis:"; then
    echo "Starting Redis container..."
    docker compose up -d redis
fi

if ! docker ps | grep -q "qdrant/qdrant:"; then
    echo "Starting Qdrant container..."
    docker compose up -d qdrant
fi

# Check if on ARM64 (Apple Silicon)
if [[ $(uname -m) == "arm64" ]]; then
    echo "Detected ARM64 architecture (Apple Silicon)."
    echo "Attempting to use multi-platform unstructured.io Docker image..."
    
    # Try to start unstructured.io container
    if ! grep -q "FORCE_SKIP_UNSTRUCTURED=true" .env.local; then
        echo "Starting unstructured.io container (multi-platform)..."
        docker compose up -d unstructured
        
        # Set up Python fallback just in case
        echo "Configuring Python fallback options for ARM64..."
        if ! grep -q "ENABLE_PYTHON_FALLBACK=true" .env.local; then
            echo "ENABLE_PYTHON_FALLBACK=true" >> .env.local
        fi
        
        # Remove existing skip if present
        if grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
            sed -i '' '/SKIP_UNSTRUCTURED=true/d' .env.local || true
        fi
    else
        echo "Skipping unstructured.io startup as configured by FORCE_SKIP_UNSTRUCTURED."
        
        # Ensure SKIP_UNSTRUCTURED is set
        if ! grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
            echo "SKIP_UNSTRUCTURED=true" >> .env.local
        fi
    fi
else
    # On x86_64, check if unstructured.io should be started
    if grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
        echo "Skipping unstructured.io as configured in .env.local."
    else
        echo "Starting unstructured.io container..."
        docker compose up -d unstructured
    fi
fi

# Enable advanced file processing in .env.local
if ! grep -q "USE_ADVANCED_FILE_PROCESSING=true" .env.local; then
    echo "Enabling advanced file processing in .env.local..."
    echo "USE_ADVANCED_FILE_PROCESSING=true" >> .env.local
fi

# Add Docling integration configuration (optional)
if [[ $(uname -m) == "arm64" ]] && ! grep -q "USE_DOCLING=" .env.local; then
    echo "# Enable Docling as an alternative document processor" >> .env.local
    echo "# USE_DOCLING=true" >> .env.local
fi

# Set API URL for unstructured.io
if ! grep -q "UNSTRUCTURED_API_URL=" .env.local; then
    echo "UNSTRUCTURED_API_URL=http://localhost:8000/general/v0/general" >> .env.local
fi

echo "Verifying service status..."
echo "Redis: $(docker ps | grep -q "redis:" && echo "Running" || echo "Not running")"
echo "Qdrant: $(docker ps | grep -q "qdrant/qdrant:" && echo "Running" || echo "Not running")"
echo "Unstructured: $(docker ps | grep -q "unstructured:" && echo "Running" || echo "Not running")"

echo ""
echo "Now you can start the application with:"
echo "bun dev"
echo ""
echo "Advanced file processing is now configured. You can upload and process files in the chat interface."