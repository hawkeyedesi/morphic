# Using Podman for Morphic Advanced File Processing

## Overview

Morphic now supports using Podman as an alternative to Docker for running the containers required for advanced file processing. This is especially useful for environments where Docker cannot be installed or used.

## What's Included

The Podman migration includes:

1. **podman-compose.yaml** - A Podman-compatible version of the Docker Compose configuration
2. **Updated start-advanced-processing.sh** - Modified to use Podman instead of Docker
3. **test-podman-setup.sh** - A script to verify your Podman setup is working correctly
4. **docs/PODMAN_MIGRATION.md** - Detailed documentation on the migration and troubleshooting

## Quick Start

### 1. Install Podman and podman-compose

Follow the installation instructions in [PODMAN_MIGRATION.md](./PODMAN_MIGRATION.md).

### 2. Start the required services

```bash
./start-advanced-processing.sh
```

This script will:
- Check for Podman and podman-compose
- Install podman-compose if it's missing
- Start Redis, Qdrant, and unstructured.io containers
- Configure your environment for advanced file processing

### 3. Verify your setup

```bash
./test-podman-setup.sh
```

This script checks that:
- Podman and podman-compose are installed
- Required containers are running
- Environment is properly configured
- Network connectivity to services is working

### 4. Start the application

```bash
bun dev
```

## Key Features

- **Multi-platform support**: Works on x86_64 and ARM64/Apple Silicon
- **Rootless container management**: Does not require root privileges
- **Compatible with existing features**: All advanced document processing features work with Podman
- **Automatic fallback mechanisms**: Uses the appropriate processing method based on your platform

## Switching Between Docker and Podman

If you need to switch back to Docker:

1. Stop the Podman containers:
   ```bash
   podman-compose -f podman-compose.yaml down
   ```

2. Start with Docker instead:
   ```bash
   docker compose up -d
   ```

## Troubleshooting

If you encounter issues:

1. Run the test script to diagnose problems:
   ```bash
   ./test-podman-setup.sh
   ```

2. Refer to [PODMAN_MIGRATION.md](./PODMAN_MIGRATION.md) for detailed troubleshooting guidance

3. Check container logs:
   ```bash
   podman logs redis
   podman logs qdrant
   podman logs unstructured
   ```

## Notes for Apple Silicon (ARM64) Users

- The Podman setup includes special handling for ARM64 architecture
- Multiple fallback options are configured automatically for ARM64
- Docling can be enabled as an alternative processor by uncommenting the relevant line in .env.local