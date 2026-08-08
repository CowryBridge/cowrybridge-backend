# cowrybridge-backend

🟢 **Live on Stellar testnet:** talks to contract [`CBFD…BF5XV`](https://stellar.expert/explorer/testnet/contract/CBFDXLLKXHGMPRRKE4L67LZFUEVYY33FGCBS4PSB2O5AG3KZBH5BF5XV) —
see [`cowrybridge-docs/deployment.md`](https://github.com/CowryBridge/cowrybridge-docs/blob/main/deployment.md)
for a verified end-to-end run.

API layer for CowryBridge: reads live pool state from the deployed Soroban
contract and builds unsigned transactions for the frontend to sign — it
never holds a private key.

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
- `GET /pools/:id/history` — recent create/contribute/release activity for
  the pool, newest first, read from the contract's on-chain events
- `POST /pools` — build an unsigned `create_pool` transaction for the
  frontend to sign with the beneficiary's wallet and submit
- `POST /pools/:id/contribute` — build an unsigned `contribute` transaction
  for the frontend to sign with the contributor's wallet and submit

The backend only ever builds transactions — it never holds a private key or
signs anything.

Part of the [CowryBridge](https://github.com/CowryBridge) organization —
see [`cowrybridge-docs`](https://github.com/CowryBridge/cowrybridge-docs) for
the full architecture.
