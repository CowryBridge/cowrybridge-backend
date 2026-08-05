# Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Structure

- `src/index.js` — app entrypoint, wires middleware + routes
- `src/config.js` — env-driven config
- `src/routes/` — one file per resource (`health.js`, `pools.js`)
- `src/middleware/` — request logging, error handling
- `src/lib/` — business logic: reads pool state from, and builds unsigned
  transactions against, the deployed `cowrybridge-contracts` contract via
  `@stellar/stellar-sdk`

## Next steps

- Set `CONTRACT_ID` in `.env` once the contract is deployed to testnet
  (see `cowrybridge-docs/deployment.md`)
