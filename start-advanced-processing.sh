#!/bin/bash

# Script to start services for advanced file processing using Podman
# Converted from Docker to Podman for compatibility

echo "Starting required services for advanced file processing with Podman..."

# Check for Podman
if ! command -v podman &> /dev/null; then
    echo "Podman is not installed. Please install Podman first."
    exit 1
fi

# Check Podman Compose
if ! command -v podman-compose &> /dev/null; then
    echo "Podman Compose not found. Installing podman-compose..."
    pip3 install podman-compose 2>/dev/null || pip install podman-compose 2>/dev/null
    
    if ! command -v podman-compose &> /dev/null; then
        echo "Failed to install podman-compose. Please install it manually:"
        echo "pip install podman-compose"
        exit 1
    fi
fi

# Check if Redis and Qdrant containers are running
echo "Checking for required services..."

# Use podman-compose.yaml for Podman
COMPOSE_FILE="podman-compose.yaml"

# Start Redis and Qdrant if not running
if ! podman ps | grep -q "redis:"; then
    echo "Starting Redis container..."
    podman-compose -f $COMPOSE_FILE up -d redis
fi

if ! podman ps | grep -q "qdrant/qdrant:"; then
    echo "Starting Qdrant container..."
    podman-compose -f $COMPOSE_FILE up -d qdrant
fi

# Check if on ARM64 (Apple Silicon)
if [[ $(uname -m) == "arm64" ]]; then
    echo "Detected ARM64 architecture (Apple Silicon)."
    echo "Attempting to use multi-platform unstructured.io Podman image..."
    
    # Try to start unstructured.io container
    if ! grep -q "FORCE_SKIP_UNSTRUCTURED=true" .env.local; then
        echo "Starting unstructured.io container (multi-platform)..."
        podman-compose -f $COMPOSE_FILE up -d unstructured
        
        # Set up Python fallback just in case
        echo "Configuring Python fallback options for ARM64..."
        if ! grep -q "ENABLE_PYTHON_FALLBACK=true" .env.local; then
            echo "ENABLE_PYTHON_FALLBACK=true" >> .env.local
        fi
        
        # Remove existing skip if present
        if grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
            # Use portable sed syntax that works across macOS and Linux
            sed -i.bak '/SKIP_UNSTRUCTURED=true/d' .env.local && rm -f .env.local.bak || true
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
        podman-compose -f $COMPOSE_FILE up -d unstructured
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
echo "Redis: $(podman ps | grep -q "redis:" && echo "Running" || echo "Not running")"
echo "Qdrant: $(podman ps | grep -q "qdrant/qdrant:" && echo "Running" || echo "Not running")"
echo "Unstructured: $(podman ps | grep -q "unstructured:" && echo "Running" || echo "Not running")"

echo ""
echo "Now you can start the application with:"
echo "bun dev"
echo ""
echo "Advanced file processing is now configured. You can upload and process files in the chat interface."