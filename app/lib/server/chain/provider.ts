import "server-only";
import { JsonRpcProvider } from "ethers";
import { serverEnv } from "@/lib/server/env";
import { CHAIN_ID } from "@/lib/shared/chain";

const globalForChain = globalThis as unknown as { pactProvider?: JsonRpcProvider };

export function getProvider(): JsonRpcProvider {
  return (globalForChain.pactProvider ??= new JsonRpcProvider(serverEnv.rpcUrl, CHAIN_ID, {
    staticNetwork: true,
    batchMaxCount: 1,
    cacheTimeout: -1,
  }));
}
