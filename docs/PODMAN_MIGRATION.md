# Migrating from Docker to Podman for Advanced File Processing

This document explains how to use Podman instead of Docker for the advanced file processing features in Morphic.

## What is Podman?

Podman is a daemonless container engine for developing, managing, and running OCI Containers. It's an alternative to Docker that doesn't require root privileges and uses a different architecture that can be more secure and lightweight.

## Why Use Podman?

- **Rootless operation**: Podman can run containers without root privileges
- **Compatible with Docker**: Most Docker commands work with Podman
- **Security**: Improved security model compared to Docker
- **No daemon**: Doesn't require a persistent background process
- **Better for environments where Docker cannot be installed**

## Setup Instructions

### 1. Install Podman

#### On macOS:
```bash
brew install podman
podman machine init
podman machine start
```

#### On Linux (Debian/Ubuntu):
```bash
sudo apt-get update
sudo apt-get install -y podman
```

#### On Linux (Fedora/RHEL):
```bash
sudo dnf install -y podman
```

### 2. Install podman-compose

```bash
pip install podman-compose
```

### 3. Run the Updated Scripts

The `start-advanced-processing.sh` script has been updated to use Podman instead of Docker. Simply run it as before:

```bash
./start-advanced-processing.sh
```

The script will:
1. Check for Podman and podman-compose
2. Use the podman-compose.yaml configuration file
3. Start the necessary containers (Redis, Qdrant, and unstructured.io)
4. Configure your environment appropriately

## Key Changes

The following files have been updated to support Podman:

1. **start-advanced-processing.sh**
   - Changed Docker commands to Podman equivalents
   - Added support for podman-compose
   - Updated the sed command to be compatible across different platforms
   - Added automatic installation of podman-compose if missing

2. **podman-compose.yaml** (New file)
   - Based on the existing docker-compose.yaml
   - Removed Docker-specific cache configuration
   - Added SELinux compatibility with `:Z` volume mount options
   - Removed platform constraints that might cause issues with Podman

## Differences Between Docker and Podman to Be Aware Of

1. **Volume Management**:
   - Podman volumes are stored in a different location than Docker volumes
   - SELinux labeling may be required for volume mounts (`:Z` suffix in the compose file)

2. **Networking**:
   - Podman's default networking might differ slightly from Docker's
   - Container communication might need additional configuration in complex setups

3. **Image Handling**:
   - Podman pulls images from the same registries as Docker
   - Image storage location is different

4. **Root vs. Rootless**:
   - Podman defaults to rootless mode, which might affect file permissions
   - Some containers that expect root privileges might need special configuration

## Troubleshooting

### Common Issues:

1. **Permission Denied Errors**:
   ```
   Error: error creating container storage: the container storage cannot be created: 
   mkdir /run/user/1000/containers: permission denied
   ```
   **Solution**: Make sure the user has proper permissions or try with `sudo`.

2. **SELinux Issues**:
   ```
   Error: SELinux denied access to a file needed by the container
   ```
   **Solution**: Add `:Z` suffix to volume mounts in podman-compose.yaml or temporarily set SELinux to permissive mode.

3. **Network Issues**:
   ```
   Error: unable to start container "xyz": unable to create network namespace: network setup failed
   ```
   **Solution**: Restart the podman service or try running with `--network=host`.

4. **podman-compose Not Found**:
   ```
   bash: podman-compose: command not found
   ```
   **Solution**: Install with `pip install podman-compose` or ensure it's in your PATH.

### Verifying Your Setup

To check if all services are running correctly:

```bash
podman ps
```

You should see Redis, Qdrant, and (if not skipped) the unstructured.io containers running.

## Converting Back to Docker

If you need to switch back to Docker for any reason:

1. Stop the Podman containers:
   ```bash
   podman-compose -f podman-compose.yaml down
   ```

2. Edit the `start-advanced-processing.sh` script to revert the changes (replace "podman" with "docker")

3. Run the original Docker Compose configuration:
   ```bash
   docker compose up -d
   ```

## References

- [Podman Official Documentation](https://podman.io/docs)
- [Podman-Compose GitHub Repository](https://github.com/containers/podman-compose)
- [Migrating from Docker to Podman](https://developers.redhat.com/blog/2020/11/19/transitioning-from-docker-to-podman)