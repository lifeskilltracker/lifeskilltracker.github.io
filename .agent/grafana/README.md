# Navigator Grafana Setup

This directory contains the Grafana and Prometheus configuration for monitoring Navigator metrics.

## Quick Start

1. **Start the stack**:
   ```bash
   cd .agent/grafana
   docker compose up -d
   ```

2. **Access Grafana**:
   - URL: http://localhost:3000
   - Default credentials: admin / admin

3. **View Navigator Dashboard**:
   - Click "Home" → Select "Navigator Metrics" from the dashboards list
   - Or navigate to: http://localhost:3000/d/navigator-metrics

## Configuration Files

- **docker-compose.yml**: Docker Compose configuration for Prometheus and Grafana
- **prometheus.yml**: Prometheus scrape configuration
- **grafana-datasource.yml**: Prometheus datasource configuration for Grafana
- **grafana-dashboards.yml**: Dashboard provisioning configuration
- **navigator-dashboard.json**: Navigator metrics dashboard definition

## Metrics Tracked

The Navigator dashboard tracks:
- Session duration
- Tasks completed
- Context compressions
- Tool usage statistics

## Stopping the Stack

```bash
cd .agent/grafana
docker compose down
```

To also remove volumes (data):
```bash
docker compose down -v
```

## Troubleshooting

**Port 3000 already in use**:
Edit `docker-compose.yml` and change the port:
```yaml
services:
  grafana:
    ports:
      - "3001:3000"  # Changed from 3000:3000
```

**Cannot connect to Prometheus**:
Check that both containers are running:
```bash
docker ps | grep navigator
```

**Data not appearing**:
Ensure Claude Code metrics are being exported to port 9091 on localhost.
