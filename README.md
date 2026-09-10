# Slot Art

Images generated purely from mathematical formulas, in the style of Hamid
Naderi Yeganeh, seeded by Solana block data and mintable as NFTs.

Every pixel `(m, n)` gets the colour `(F(C0(x, y)), F(C1(x, y)), F(C2(x, y)))`
where `C_v` is built only from cosines, exponentials, absolute values, floors
and arccos. The full expanded formula is shown next to every image.

## Layout

- `packages/engine`: the formula engine. A zod parameter schema, a compiler
  from parameters to a small expression IR, and three backends: JavaScript
  (canonical CPU render, bit-for-bit deterministic on V8), GLSL (WebGL2
  preview) and LaTeX (readable math). `src/node.ts` adds a dependency-free
  PNG encoder and SHA-256 hashing.
- `apps/web`: Next.js app. Block art (`/block`), gallery of recent slots
  (`/gallery`), text and image to math (`/create`), recorded mints (`/mints`),
  and API routes for block data, PNG rendering, LLM generation and minting.
- `MAPPING.md`: the exact rules that turn block data into parameters.

## Yeganeh primitives used

| Primitive | Where |
| --- | --- |
| Clamp `F(t) = floor(255 e^{-e^{-1000t}} \|t\|^{e^{-e^{1000(t-1)}}})` | final colour, `backend-js.ts` |
| Step mask `S_k(g) = e^{-e^{-kg}}` | every shape mask, `compile.ts` |
| Triangle wave `arccos(cos(kt)) / pi` | scalloped edges and stripes |
| Noise `E = sum_k (25/26)^k T_k` with frequencies `(23/20)^k` | clouds and textures, `noiseField` |
| Layer occlusion `A_v = sum_s U_{s-1} W_{v,s}` | the layer stack in every backend |
| Deterministic randomness `cos(3s)`, `cos(5s)`, `(19/20)^s` | scatter and jitter arrangements |

The clamp is written with a double exponential in the exponent so that the
exponent is 1 below `t = 1` and 0 above it, which is what makes it clamp.

## Running locally

```bash
pnpm install
docker run -d --name slotart-pg -e POSTGRES_USER=slotart -e POSTGRES_PASSWORD=slotart \
  -e POSTGRES_DB=slotart -p 5433:5432 postgres:16-alpine
cp apps/web/.env.example apps/web/.env
pnpm --filter web db:generate && pnpm --filter web db:push
pnpm dev
```

Set `OPENROUTER_API_KEY` in `apps/web/.env` for the create page, or
`LLM_MOCK=1` to use presets instead of a model. The block pages need only a
public Solana RPC; the database is needed for minting and the mints page.

## Tests

```bash
pnpm --filter @slotart/engine test   # unit tests, writes sample PNGs to packages/engine/test/out
pnpm --filter web test               # LLM helpers and the mint service (needs Postgres)
pnpm --filter web e2e                # Playwright, runs against a mock Solana RPC and the mock model
```

GitHub Actions runs all three on every push (`.github/workflows/ci.yml`).

## Determinism

`renderCPU(params, w, h)` uses only `Math.cos`, `Math.sin`, `Math.exp`,
`Math.pow`, `Math.acos`, `Math.atan2`, `Math.sqrt`, `Math.floor` and
`Math.abs` in a fixed evaluation order. V8 implements these with its own
fdlibm port, so the same parameters give the same bytes across machines
running Node or Chromium. The engine test suite renders each preset twice and
compares hashes; `packages/engine/test/out/hashes.json` records them. The GPU
preview runs the same formula in float32 and can differ in the last bit; the
CPU render is the canonical image for minting.

## Minting

Minting is currently a dummy: `POST /api/mint` validates the request, recomputes
the parameters and canonical image hash server side, claims the slot in the
`SlotClaim` table (unique on chain, network and slot), stores the metadata JSON
and returns placeholder addresses. `lib/minter.ts` defines the `Minter`
interface a Metaplex Core implementation will fill; `SlotClaim` mirrors the
account an on-chain program would keep per slot. Devnet is the default and
mainnet is refused unless `ENABLE_MAINNET=true`.
