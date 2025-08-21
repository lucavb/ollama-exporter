### Ollama Prometheus Exporter

Minimal exporter that scrapes an Ollama server and exposes Prometheus metrics at `/metrics` and a basic `/health` endpoint.

### Features

- **Metrics**: Version info, model inventory, running models, VRAM usage, scrape stats
- **Endpoints**: `/metrics`, `/health`
- **Configurable**: Port, scrape interval, Ollama host, timeout, log level

### Requirements

- Docker (Docker Hub image available at [lucabecker42/ollama-exporter](https://hub.docker.com/r/lucabecker42/ollama-exporter))
- Ollama server reachable from the exporter
- For local development: Node.js 24+
- For systemd install: Linux with systemd

### Docker (Recommended)

Pull and run the published image from Docker Hub:

```bash
docker run --rm -p 8000:8000 \
  -e PORT=8000 \
  -e INTERVAL=30 \
  -e OLLAMA_HOST=host.docker.internal:11434 \
  -e API_TIMEOUT=30 \
  -e LOG_LEVEL=INFO \
  --name ollama-exporter \
  lucabecker42/ollama-exporter:latest
```

The image is available at: https://hub.docker.com/r/lucabecker42/ollama-exporter

### Docker Compose

Example `docker-compose.yml` that runs the exporter alongside Prometheus:

```yaml
services:
    ollama-exporter:
        image: lucabecker42/ollama-exporter:latest
        ports:
            - '8000:8000'
        environment:
            - PORT=8000
            - INTERVAL=30
            - OLLAMA_HOST=host.docker.internal:11434
            - API_TIMEOUT=30
            - LOG_LEVEL=INFO
        restart: unless-stopped

    prometheus:
        image: prom/prometheus:latest
        ports:
            - '9090:9090'
        volumes:
            - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
        command:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.path=/prometheus'
            - '--web.console.libraries=/etc/prometheus/console_libraries'
            - '--web.console.templates=/etc/prometheus/consoles'
        restart: unless-stopped
```

Example `prometheus.yml` configuration:

```yaml
global:
    scrape_interval: 30s

scrape_configs:
    - job_name: 'ollama-exporter'
      static_configs:
          - targets: ['ollama-exporter:8000']
      scrape_interval: 30s
```

Start with:

```bash
docker compose up -d
```

### Systemd install

This installs the exporter to `/opt/ollama-exporter`, sets up a dedicated user, builds the TypeScript project, and installs dependencies. The service is configured via `/etc/ollama-exporter.env`.

```bash
sudo bash ./install-systemd.sh
```

Environment file defaults (created at `/etc/ollama-exporter.env`):

```bash
PORT=8000
INTERVAL=30
OLLAMA_HOST=localhost:11434
API_TIMEOUT=30
LOG_LEVEL=INFO
```

Service management:

```bash
sudo systemctl status ollama-exporter
sudo systemctl restart ollama-exporter
sudo systemctl enable ollama-exporter
```

Uninstall:

```bash
sudo systemctl disable --now ollama-exporter
sudo rm -f /etc/systemd/system/ollama-exporter.service
sudo rm -f /etc/ollama-exporter.env
sudo rm -rf /opt/ollama-exporter
sudo systemctl daemon-reload
```

### Configuration options

- **-p, --port**: Port to serve metrics on (default: 8000)
- **-i, --interval**: Scrape interval in seconds (default: 30)
- **--ollama-host**: Ollama server host:port (default: localhost:11434)
- **-t, --api-timeout**: Timeout for Ollama API calls in seconds (default: 30)
- **-l, --log-level**: One of DEBUG, INFO, WARNING, ERROR (default: INFO)
- **--validate-config**: Validate configuration and exit

### Prometheus scrape config example

```yaml
- job_name: 'ollama-exporter'
  static_configs:
      - targets: ['exporter-hostname:8000']
```

### Development

If you want to build from source or contribute to the project:

#### Building Docker image locally

```bash
docker build -t ollama-exporter:latest .
```

#### Local development

1. Install dependencies:

```bash
npm install
```

2. Run in development mode:

```bash
npm start -- \
  --port 8000 \
  --interval 30 \
  --ollama-host localhost:11434 \
  --api-timeout 30 \
  --log-level INFO
```

Visit `http://localhost:8000/metrics` and `http://localhost:8000/health`.

#### Testing

```bash
npm test
```

### Maintainer

Luca Becker — hello@luca-becker.me — https://luca-becker.me

### License

GPL-3.0-only
