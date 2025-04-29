#!/bin/bash

# Test script for Podman setup in Morphic advanced file processing
# This script checks if Podman is properly configured and the required containers are running

echo "======================================="
echo "Testing Podman Setup for Morphic"
echo "======================================="

# Check if Podman is installed
if ! command -v podman &> /dev/null; then
    echo "❌ Podman is not installed. Please install Podman first."
    echo "   See docs/PODMAN_MIGRATION.md for installation instructions."
    exit 1
else
    PODMAN_VERSION=$(podman --version)
    echo "✅ Podman is installed: $PODMAN_VERSION"
fi

# Check if podman-compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo "❌ podman-compose is not installed. Please install podman-compose first."
    echo "   Try: pip install podman-compose"
    exit 1
else
    echo "✅ podman-compose is installed"
fi

# Check if containers are running
echo -e "\nChecking required containers..."

# Check Redis
if podman ps | grep -q "redis:"; then
    echo "✅ Redis container is running"
else
    echo "❌ Redis container is not running"
    echo "   Try running: ./start-advanced-processing.sh"
fi

# Check Qdrant
if podman ps | grep -q "qdrant/qdrant:"; then
    echo "✅ Qdrant container is running"
else
    echo "❌ Qdrant container is not running"
    echo "   Try running: ./start-advanced-processing.sh"
fi

# Check Unstructured.io (if not skipped)
if grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
    echo "ℹ️ Unstructured.io is skipped as per configuration"
else
    if podman ps | grep -q "unstructured:"; then
        echo "✅ Unstructured.io container is running"
    else
        echo "❌ Unstructured.io container is not running"
        echo "   Try running: ./start-advanced-processing.sh"
    fi
fi

# Check environment configuration
echo -e "\nChecking environment configuration..."

# Check .env.local exists
if [ -f .env.local ]; then
    echo "✅ .env.local file exists"

    # Check if advanced file processing is enabled
    if grep -q "USE_ADVANCED_FILE_PROCESSING=true" .env.local; then
        echo "✅ Advanced file processing is enabled"
    else
        echo "❌ Advanced file processing is not enabled"
        echo "   Add USE_ADVANCED_FILE_PROCESSING=true to .env.local"
    fi

    # Check if UNSTRUCTURED_API_URL is set
    if grep -q "UNSTRUCTURED_API_URL=" .env.local; then
        echo "✅ UNSTRUCTURED_API_URL is configured"
    else
        echo "❌ UNSTRUCTURED_API_URL is not set"
        echo "   Add UNSTRUCTURED_API_URL=http://localhost:8000/general/v0/general to .env.local"
    fi
else
    echo "❌ .env.local file doesn't exist"
    echo "   Try running: ./start-advanced-processing.sh"
fi

# Test network connectivity to services
echo -e "\nTesting network connectivity to services..."

# Test Redis connectivity
if nc -z localhost 6379 2>/dev/null; then
    echo "✅ Redis port (6379) is accessible"
else
    echo "❌ Cannot connect to Redis port"
    echo "   Check if the container is running and the port is properly mapped"
fi

# Test Qdrant connectivity
if nc -z localhost 6333 2>/dev/null; then
    echo "✅ Qdrant port (6333) is accessible"
else
    echo "❌ Cannot connect to Qdrant port"
    echo "   Check if the container is running and the port is properly mapped"
fi

# Test Unstructured.io connectivity (if not skipped)
if ! grep -q "SKIP_UNSTRUCTURED=true" .env.local; then
    if nc -z localhost 8000 2>/dev/null; then
        echo "✅ Unstructured.io port (8000) is accessible"
    else
        echo "❌ Cannot connect to Unstructured.io port"
        echo "   Check if the container is running and the port is properly mapped"
    fi
fi

echo -e "\n======================================="
echo "Podman Setup Test Complete"
echo "======================================="

# Summary
echo -e "\nSUMMARY:"

ERRORS=0
if ! podman ps | grep -q "redis:"; then
    ERRORS=$((ERRORS+1))
fi
if ! podman ps | grep -q "qdrant/qdrant:"; then
    ERRORS=$((ERRORS+1))
fi
if ! grep -q "SKIP_UNSTRUCTURED=true" .env.local && ! podman ps | grep -q "unstructured:"; then
    ERRORS=$((ERRORS+1))
fi
if ! [ -f .env.local ]; then
    ERRORS=$((ERRORS+1))
fi
if [ -f .env.local ] && ! grep -q "USE_ADVANCED_FILE_PROCESSING=true" .env.local; then
    ERRORS=$((ERRORS+1))
fi

if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Your Podman setup appears to be working correctly."
    echo "   You can now start your application with: bun dev"
else
    echo "❌ Found $ERRORS issues that need to be resolved."
    echo "   Please fix the issues above and run this test again."
    echo "   For help, refer to docs/PODMAN_MIGRATION.md"
fi

echo ""