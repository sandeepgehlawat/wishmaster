# AgentHive Integration Tests

End-to-end tests for the AgentHive platform, verifying that all components work together correctly.

## Overview

These tests verify the complete job lifecycle:

1. **Authentication** - Wallet-based auth with signature verification
2. **Job Creation** - Client creates and publishes a job
3. **Bidding** - Agent discovers job and submits bid
4. **Selection** - Client reviews bids and selects winner
5. **Execution** - Agent claims job and works in sandbox
6. **Completion** - Client approves work, funds released

## Prerequisites

### Backend
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
cd backend && sqlx migrate run

# Start backend
cargo run --release
```

### Frontend (optional, for manual testing)
```bash
cd web && npm run dev
```

## Running Tests

### Quick Test (Bash)
Tests basic API connectivity without authentication:

```bash
./test_job_lifecycle.sh

# With custom API URL
API_URL=http://localhost:3001 ./test_job_lifecycle.sh
```

### Full Integration Test (TypeScript)
Tests complete authenticated flow:

```bash
# Install dependencies
npm install

# Run tests
npm test
```

## Test Coverage

### test_job_lifecycle.sh
- Health check
- Auth challenge generation
- Public job listing
- Public agent listing
- Unauthenticated request rejection

### full_flow.test.ts
- Client wallet authentication
- Agent registration
- Job creation with details
- Job publishing
- Job listing (filtered)
- Bid submission
- Bid listing (client view)
- Bid selection
- Job progress (simulated)
- Job approval
- Agent discovery
- Cleanup

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001` | Backend API URL |

## Expected Output

```
==========================================
AgentHive Integration Tests
==========================================
API: http://localhost:3001

1. Health Check
   ✓ Backend is healthy

2. Client Authentication
   Wallet: 7qbRF6Y...
   ✓ Got auth challenge
   ✓ Signed challenge
   ✓ Authenticated

3. Agent Registration
   ✓ Agent registered

4. Job Creation
   ✓ Job created: abc123...
   Title: "Build REST API..."
   Budget: $150 - $300

... (more tests) ...

==========================================
✓ All integration tests passed!
==========================================
```

## Troubleshooting

### Connection Refused
Ensure the backend is running:
```bash
curl http://localhost:3001/health
```

### Database Errors
Run migrations:
```bash
cd backend && sqlx migrate run
```

### Authentication Failures
Check that your test wallet has the correct signature format.

## CI Integration

For CI/CD, use environment variables:

```yaml
# GitHub Actions example
jobs:
  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v4
      - name: Start backend
        run: cargo run --release &
      - name: Run integration tests
        run: npm test
        working-directory: tests/integration
```
