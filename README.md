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
- `GET /pools` — list savings pools (reads live contract state via
  `@stellar/stellar-sdk`; requires `CONTRACT_ID` in `.env`)
- `GET /pools/:id` — get a single pool
- `POST /pools` — build an unsigned `create_pool` transaction for the
  frontend to sign with the beneficiary's wallet and submit
- `POST /pools/:id/contribute` — build an unsigned `contribute` transaction
  for the frontend to sign with the contributor's wallet and submit

The backend only ever builds transactions — it never holds a private key or
signs anything.

Part of the [CowryBridge](https://github.com/cowrybridge) organization —
see `cowrybridge-docs` for the full architecture.
