// Deploy KriptoNr1 to Base from your own key — no Remix, no bundler.
//
//   PRIVATE_KEY=0x...   your deployer key (kept local, never shared)
//   OWNER=0x...         optional, the house/owner address (default: 0x9d17…f75e,
//                       the address baked into lib/contract.ts's fallback)
//   FUND_ETH=0.01       optional, ETH to seed the bankroll on deploy
//   CHAIN=base          optional: base (default) or base-sepolia
//   RPC_URL=https://... optional custom RPC
//
// Usage:  PRIVATE_KEY=0x... FUND_ETH=0.01 node scripts/deploy.mjs
//
// It deploys through the standard CREATE2 proxy (0x4e59…4956C) with a fixed
// salt, so with the default OWNER the contract always lands at the address
// already wired into lib/contract.ts. Change OWNER and you get a different
// (still deterministic) address — set NEXT_PUBLIC_CONTRACT_ADDRESS to it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  keccak256,
  stringToBytes,
  encodeAbiParameters,
  concatHex,
  getContractAddress,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

const PROXY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const SALT = keccak256(stringToBytes("KRIPTO-NR1-rocket-lottery-v3"));
const DEFAULT_OWNER = "0x9d17999944529b3f46ae580b4ffd2df8ef71f75e";

const pk = process.env.PRIVATE_KEY;
if (!pk) throw new Error("Set PRIVATE_KEY (0x-prefixed) in the environment.");
const owner = (process.env.OWNER || DEFAULT_OWNER).toLowerCase();
const fundEth = process.env.FUND_ETH || "0";
const chain = process.env.CHAIN === "base-sepolia" ? baseSepolia : base;

const here = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(
  readFileSync(join(here, "../contracts/artifacts/KriptoNr1.json"), "utf8"),
);

const initCode = concatHex([
  artifact.bytecode,
  encodeAbiParameters([{ type: "address" }], [owner]),
]);
const predicted = getContractAddress({
  opcode: "CREATE2",
  from: PROXY,
  salt: SALT,
  bytecode: initCode,
});
const deployData = concatHex([SALT, initCode]);

const account = privateKeyToAccount(pk);
const rpc = process.env.RPC_URL ? http(process.env.RPC_URL) : http();
const pub = createPublicClient({ chain, transport: rpc });
const wallet = createWalletClient({ account, chain, transport: rpc });

console.log("Chain:          ", chain.name);
console.log("Deployer:       ", account.address);
console.log("Owner (house):  ", owner);
console.log("Predicted addr: ", predicted);
console.log("Seed bankroll:  ", fundEth, "ETH");

const existing = await pub.getBytecode({ address: predicted });
if (existing && existing !== "0x") {
  console.log("\nAlready deployed at", predicted, "— nothing to do.");
  process.exit(0);
}

const hash = await wallet.sendTransaction({
  to: PROXY,
  data: deployData,
  value: parseEther(fundEth),
});
console.log("\nDeploy tx:", hash);
const receipt = await pub.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("Deploy tx reverted");

const code = await pub.getBytecode({ address: predicted });
if (!code || code === "0x") throw new Error("No code at predicted address");
const onchainOwner = await pub.readContract({
  address: predicted,
  abi: artifact.abi,
  functionName: "owner",
});
const bankroll = await pub.readContract({
  address: predicted,
  abi: artifact.abi,
  functionName: "bankroll",
});

console.log("\n✅ Deployed:", predicted);
console.log("   owner:   ", onchainOwner);
console.log("   bankroll:", formatEther(bankroll), "ETH");
console.log("\nNext steps:");
console.log("  1. Ensure the bankroll is >= 0.01 ETH (send ETH to the address");
console.log("     above, or re-run with FUND_ETH). Needed to pay X10 wins.");
console.log("  2. Call fundPromo() with your free-launch budget (promo pool).");
console.log("  3. Set NEXT_PUBLIC_CONTRACT_ADDRESS =", predicted);
console.log("     and update the fallback in lib/contract.ts.");
