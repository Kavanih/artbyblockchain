import http from "node:http";

// A tiny Solana JSON-RPC stand-in so e2e runs are offline and stable.
const GENESIS = {
  blockHeight: 0,
  blockTime: 1584368940,
  blockhash: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn",
  parentSlot: 0,
  previousBlockhash: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn",
  transactions: []
};

function fakeBlock(slot: number) {
  const txs = [];
  const n = 1 + (slot % 7);
  for (let i = 0; i < n; i++) {
    txs.push({
      meta: { err: null, fee: 5000 * (i + 1), computeUnitsConsumed: 150 * (i + 1), loadedAddresses: { writable: [], readonly: [] } },
      transaction: {
        signatures: [`5${"KxQ".repeat(20)}${slot}${i}`.slice(0, 87)],
        message: {
          accountKeys: ["76rcGHdPvgs8G1XrzCXUTWtwgT59AFDvpB4VbTS2TBBJ", "Vote111111111111111111111111111111111111111", "11111111111111111111111111111111"],
          instructions: [{ programIdIndex: 1 + (i % 2) }]
        }
      }
    });
  }
  return {
    blockHeight: slot - 100,
    blockTime: 1700000000 + slot,
    blockhash: `${"9S4uk1BB2kh9o36tHaZj3MkZAizooecqMssJpshzfmn".slice(0, 43 - String(slot).length)}${slot}`,
    parentSlot: slot - 1,
    previousBlockhash: "9S4uk1BB2kh9o36tHaZj3MkZAizooecqMssJpshzfmnE",
    transactions: txs
  };
}

export const TIP = 1000;

export function startMockRpc(port: number) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { id, method, params } = JSON.parse(body || "{}");
      let result: unknown = null;
      let error: unknown = undefined;
      if (method === "getSlot") result = TIP;
      else if (method === "getBlocks") {
        const [start, end] = params as number[];
        result = [];
        for (let s = start; s <= end; s++) if (s % 3 !== 0) (result as number[]).push(s);
      } else if (method === "getBlock") {
        const slot = (params as number[])[0];
        if (slot === 0) result = GENESIS;
        else if (slot > TIP || slot % 3 === 0) error = { code: -32009, message: `Slot ${slot} was skipped, or missing in long-term storage` };
        else result = fakeBlock(slot);
      } else error = { code: -32601, message: "method not found" };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result }));
    });
  });
  return new Promise<http.Server>((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && process.argv[1].endsWith("mock-rpc.ts")) {
  const port = Number(process.env.MOCK_RPC_PORT ?? 8899);
  startMockRpc(port).then(() => console.log(`mock rpc on ${port}`));
}
