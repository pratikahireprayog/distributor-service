# Distributor Service - Temporal Worker

This service is a Temporal worker that handles the distribution of orders to various delivery network partners.

## What is this repository for?

- Temporal worker service for distributing orders to delivery partners
- Handles partner selection based on business rules
- Integrates with multiple delivery network partners

## How do I get set up?

### Prerequisites

- Node.js 20+
- Temporal server running (local or remote)
- MongoDB (for data persistence)

### Installation

```bash
# Install dependencies
npm install

# Build the application
npm run build
```

### Configuration

Create a `.env` file in the root directory with the following variables:

```
# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# MongoDB
MONGODB_URI=mongodb://localhost:27017/distributor

# Logging
LOG_LEVEL=info
```

### Running the service

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

### Docker

```bash
# Build the Docker image
docker build -t distributor-service .

# Run the container
docker run -p 3039:3039 --env-file .env distributor-service
```

## Architecture

This service is built as a pure Temporal worker without any API endpoints. It registers activities that can be called from Temporal workflows.

### Key Components

- **Temporal Worker**: Listens for tasks on the configured task queue
- **Activity Registry**: Registers business logic as Temporal activities
- **Distributor Service**: Contains the core business logic for partner selection
- **Network Partner Factory**: Creates the appropriate partner implementation based on business rules

## Workflows

Workflows should be defined in a separate service and can call the activities registered by this worker.

## Who do I talk to?

- Repo owner or admin
- Delivery orchestration team
