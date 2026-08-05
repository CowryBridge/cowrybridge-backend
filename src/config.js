import "dotenv/config";
import { Networks } from "@stellar/stellar-sdk";

export const config = {
  port: process.env.PORT || 4000,
  stellarNetwork: process.env.STELLAR_NETWORK || "testnet",
  // Live getters (rather than values captured once at import time) so tests
  // can flip STELLAR_NETWORK / CONTRACT_ID per-case without re-importing.
  get networkPassphrase() {
    return process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
  },
  horizonUrl: process.env.HORIZON_URL || "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  get contractId() {
    return process.env.CONTRACT_ID || null;
  },
};
