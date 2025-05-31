# Open WebUI with Podman Setup

## Run Open WebUI with Podman: Remove --add-host flag (Podman 5.3+ handles this automatically):


```bash
podman run -d -p 3000:8080 -v open-webui:/app/backend/data --name open-webui --restart always ghcr.io/open-webui/open-webui:main
```

## Key Differences from Docker:
- `host.containers.internal` instead of `host.docker.internal` 
- Podman volumes work the same way
- Same port mapping: `-p 3000:8080`

## SearXNG Configuration
In Open WebUI settings, use:
- **SearXNG Query URL**: `http://host.containers.internal:8080/search?q=<query>`

## Podman Commands (same as Docker)
- Start: `podman start open-webui`
- Stop: `podman stop open-webui`  
- Logs: `podman logs open-webui`
- Remove: `podman rm open-webui`

## Volume Backup/Restore for Podman
```bash
# Export
podman run --rm -v open-webui:/data -v $(pwd):/backup alpine tar czf /backup/open-webui-backup.tar.gz -C /data .

# Import  
podman volume create open-webui
podman run --rm -v open-webui:/data -v $(pwd):/backup alpine tar xzf /backup/open-webui-backup.tar.gz -C /data
```

## Access
Open WebUI will be available at: http://localhost:3000