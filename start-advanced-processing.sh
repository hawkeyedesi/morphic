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
    echo "unstructured.io is not available for ARM64. Using fallback processing."
    
    # Update .env.local to use fallback processing
    if ! grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
        echo "Updating .env.local with fallback configuration..."
        echo "SKIP_UNSTRUCTURED=true" >> .env.local
    fi
else
    # On x86_64, check if unstructured.io should be started
    if grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
        echo "Skipping unstructured.io as configured in .env.local."
    else
        # Uncomment unstructured service in docker-compose.yaml if needed
        if grep -q "#   unstructured:" docker-compose.yaml; then
            echo "You may want to uncomment unstructured.io service in docker-compose.yaml and run:"
            echo "docker compose up -d unstructured"
        else
            echo "Starting unstructured.io container..."
            docker compose up -d unstructured
        fi
    fi
fi

# Enable advanced file processing in .env.local
if ! grep -q "USE_ADVANCED_FILE_PROCESSING=true" .env.local; then
    echo "Enabling advanced file processing in .env.local..."
    echo "USE_ADVANCED_FILE_PROCESSING=true" >> .env.local
fi

echo "Verifying service status..."
echo "Redis: $(docker ps | grep -q "redis:" && echo "Running" || echo "Not running")"
echo "Qdrant: $(docker ps | grep -q "qdrant/qdrant:" && echo "Running" || echo "Not running")"

echo ""
echo "Now you can start the application with:"
echo "bun dev"
echo ""
echo "Advanced file processing is now configured. You can upload and process files in the chat interface."