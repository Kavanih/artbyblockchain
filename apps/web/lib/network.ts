// Client-safe network selection. Mainnet is only allowed behind a flag.
export type MintNetwork = "devnet" | "mainnet-beta";

export function mintNetwork(): MintNetwork {
  const want = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  const mainnetOk = process.env.NEXT_PUBLIC_ENABLE_MAINNET === "true";
  if (want === "mainnet-beta" && mainnetOk) return "mainnet-beta";
  return "devnet";
}

export function walletEndpoint(): string {
  return mintNetwork() === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com";
}
