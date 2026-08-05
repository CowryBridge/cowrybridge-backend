// Business logic for reading/writing pool state via the deployed
// cowrybridge-contracts Soroban contract. Currently mocked — replace with
// real @stellar/stellar-sdk contract calls once CONTRACT_ID is set in .env.

const mockPools = [
  {
    id: "pool_demo",
    beneficiary: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    targetAmount: 1000,
    currentAmount: 250,
    released: false,
  },
];

export async function listPools() {
  return mockPools;
}

export async function getPool(id) {
  return mockPools.find((p) => p.id === id) || null;
}
