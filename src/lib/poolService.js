// Business logic for reading pool state from, and building unsigned
// transactions against, the deployed cowrybridge-contracts Soroban contract.
//
// The contract stores a single Pool per deployed instance, so CONTRACT_ID
// identifies both "the contract" and "the pool" — pool ids used throughout
// this API are the contract id itself.

import * as StellarSdk from "@stellar/stellar-sdk";
import { config } from "../config.js";

const server = new StellarSdk.rpc.Server(config.sorobanRpcUrl);

// A syntactically valid but unfunded account used only to simulate read-only
// calls. It never signs or submits anything, so it doesn't need to exist on
// the ledger.
const SIMULATION_SOURCE = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32));

function mapPool(native) {
  return {
    id: config.contractId,
    beneficiary: native.beneficiary,
    token: native.token,
    targetAmount: Number(native.target_amount),
    currentAmount: Number(native.current_amount),
    released: native.released,
  };
}

function buildCallTx(sourceAccount, method, args) {
  const contract = new StellarSdk.Contract(config.contractId);
  return new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
}

async function simulateGetPool() {
  const tx = buildCallTx(new StellarSdk.Account(SIMULATION_SOURCE, "0"), "get_pool", []);
  const sim = await server.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    // The contract itself reports "no pool yet" as an Err(PoolNotFound),
    // which surfaces here as a simulation error rather than a thrown
    // exception — treat it the same as "not found".
    return null;
  }

  if (!sim.result?.retval) return null;
  return mapPool(StellarSdk.scValToNative(sim.result.retval));
}

export async function listPools() {
  if (!config.contractId) return [];
  const pool = await simulateGetPool();
  return pool ? [pool] : [];
}

export async function getPool(id) {
  if (!config.contractId || id !== config.contractId) return null;
  return simulateGetPool();
}

export async function buildCreatePoolTx({ beneficiary, targetAmount, token }) {
  const account = await server.getAccount(beneficiary);
  const tx = buildCallTx(account, "create_pool", [
    new StellarSdk.Address(beneficiary).toScVal(),
    StellarSdk.nativeToScVal(targetAmount, { type: "i128" }),
    new StellarSdk.Address(token).toScVal(),
  ]);
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

export async function buildContributeTx({ from, amount }) {
  const account = await server.getAccount(from);
  const tx = buildCallTx(account, "contribute", [
    new StellarSdk.Address(from).toScVal(),
    StellarSdk.nativeToScVal(amount, { type: "i128" }),
  ]);
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}
