# NER Visualizer (Dockerized)

A lightweight, single-page web application for visualizing Named Entity Recognition results from the NER service API, packaged as a Docker container.

## Features

- **Text Input**: Enter or paste text for entity recognition
- **Entity Highlighting**: Entities are highlighted in different colors based on type:
  - 🟡 **ORG** - Organizations (yellow)
  - 🔵 **NAME** - Person names (blue)
  - 🟢 **GEO** - Geographic locations (green)
- **Entity Table**: Detailed list of all detected entities with positions
- **Health Check**: Button to check API service health
- **Interactive**: Click on highlighted entities to see details
- **Responsive Design**: Works on desktop and mobile devices
- **Dockerized**: Runs as a lightweight Nginx container

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Make sure the NER API image exists**:
   ```bash
   docker images | grep ner-uz-solution
