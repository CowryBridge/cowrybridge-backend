# cowrybridge-backend

API layer for CowryBridge. Indexes Stellar/Soroban pool state and serves the
frontend.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Endpoints

- `GET /health` — liveness check
- `GET /pools` — list savings pools
- `GET /pools/:id` — get a single pool (currently mocked; wire up to the
  deployed `cowrybridge-contracts` contract via `@stellar/stellar-sdk` next)

Part of the [CowryBridge](https://github.com/cowrybridge) organization —
see `cowrybridge-docs` for the full architecture.
