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
- `src/lib/` — business logic (Stellar/Soroban reads live here, currently mocked)

## Next steps

- Replace `src/lib/poolService.js` mock data with real Soroban contract
  reads via `@stellar/stellar-sdk`, once `CONTRACT_ID` is set in `.env`
- Add input validation on POST routes once contribute/create endpoints exist
