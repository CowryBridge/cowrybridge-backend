import "dotenv/config";

export const config = {
  port: process.env.PORT || 4000,
  stellarNetwork: process.env.STELLAR_NETWORK || "testnet",
  horizonUrl: process.env.HORIZON_URL || "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  contractId: process.env.CONTRACT_ID || null,
};
