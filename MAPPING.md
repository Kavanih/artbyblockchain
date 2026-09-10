# Block to formula mapping (version 1)

Every block-art image is a pure function of the block data below. Anyone can
recompute the image by fetching the block, applying these rules to obtain the
parameter JSON, and rendering it with `@slotart/engine` (`renderCPU`). The
code that implements this file is `apps/web/lib/mapping.ts`; the engine's
parameter schema is `packages/engine/src/schema.ts`.

## Inputs (from `getBlock(slot, {transactionDetails: "full", maxSupportedTransactionVersion: 0})`)

| Symbol | Meaning |
| --- | --- |
| `slot` | the requested slot number |
| `H[0..31]` | the block's `blockhash`, base58 decoded to 32 bytes |
| `T` | number of transactions in the block |
| `Fee` | sum of `meta.fee` over all transactions, in lamports |
| `P` | distinct program IDs invoked by top-level instructions, sorted as base58 strings; `K = |P|` |
| `p_i` | program ID `i` base58 decoded (32 bytes) |
| `tau` | `blockTime` in unix seconds (0 if null) |
| `G[0..63]` | the first signature of the first transaction, base58 decoded (64 bytes); if the block has no transactions, `G = H || H` |

Helpers: `h(i) = H[i mod 32]`, `g(i) = G[i mod 64]`, `uh(i) = h(i)/255`,
`ug(i) = g(i)/255`, `r3(v)` rounds `v` to three decimals, `mix(a, b, t) = a + (b - a) t`
per channel, and `hsl(h, s, l)` is the standard CSS HSL to RGB conversion with
each channel rounded to three decimals.

## Global parameters

- `version = 1`, `seed = slot mod 1000`, `view = {scale: 1, cx: 0, cy: 0}`.
- `day = (1 - cos(2 pi (tau mod 86400) / 86400)) / 2` (0 at UTC midnight, 1 at UTC noon).
- Background gradient: `top = mix([0.03, 0.04, 0.12], [0.25, 0.5, 0.9], day)`,
  `bottom = mix([0.1, 0.08, 0.2], [0.9, 0.85, 0.8], day)`.
- Background cloud noise (mode `cloud`, colour `[1, 0.97, 0.94]`, gain 2):
  - `octaves = 6 + (K mod 9)`
  - `frequency = r3(2 + (S0 mod 32) / 4)` where `S0 = sum_i p_i[0]`
  - `seed = S1 mod 1000` where `S1 = sum_i p_i[1]`
  - `amplitude = r3(0.6 + 0.4 uh(0))`, `threshold = r3(0.05 + 0.25 uh(1))`

## Layers

Number of layers `L = 1 + (T mod 6)`. Layer `l` (0 is nearest) reads blockhash
bytes at offset `o = 2 + 5 l` and signature bytes at offset `q = 10 l`.

- `feeHue = floor(Fee / 1000) mod 360`; `hue_l = (feeHue + 137.5 l) mod 360`.
- Shape kind: `h(o) mod 5` is 0, 1, 2 for `disc`, 3 for `ring`, 4 for `band`.
- Arrangement: `single` for `band`; otherwise `h(o+1) mod 4` with `c = h(o+2)`:
  - 0: `grid` with `cols = 3 + (c mod 8)`, `rows = 2 + (floor(c / 8) mod 5)`,
    `spacing = [r3(2.4 rx), r3(2.4 ry)]`, `perspective = r3(0.3 + ug(q+8))`,
    `depthFade = 0.4`, `stagger = 1`, `jitter = 0.2`
  - 1: `ring` with `count = 5 + (c mod 12)`, `radius = r3(0.25 + 0.5 ug(q+8))`,
    `faceOut = true`, `phase = r3(2 pi ug(q+9))`
  - 2: `scatter` with `count = 8 + (c mod 40)`, `spread = [0.9, 0.9]`,
    `sizeJitter = 0.4`, `shrink = 0.02`
  - 3: `single`
- Centre: `cx = r3(-0.6 + 1.2 uh(o+3))`, `cy = r3(-0.6 + 1.2 uh(o+4))`; for
  `band` the centre y is `r3(cy - 0.5)`.
- Size: `rx = r3(0.05 + 0.3 ug(q))`, `ry = r3(rx (0.4 + 0.8 ug(q+1)))`; for
  `band` the size is `[3, r3(0.1 + 0.25 ug(q+1))]`.
- Rotation: `r3(2 pi ug(q+2))`, 0 for `band`.
- `squareness = r3(1 + 2.5 ug(q+5))`, `ringWidth = 0.25`, `softness = 300`.
- Scallop present when `g(q+3)` is odd: `count = 3 + (g(q+4) mod 14)`,
  `depth = r3(0.05 + 0.3 ug(q+4))`.
- Band wave: `frequency = 2 + (g(q+4) mod 10)`, `amplitude = r3(0.1 + 0.3 ug(q+3))`.
- Shading: `sat = r3(0.5 + 0.4 ug(q+6))`, `light = r3(0.45 + 0.2 ug(q+7))`,
  `color = hsl(hue_l, sat, light)`, `edge = hsl(hue_l + 20, sat, light / 2)`.
- Stripes present when `g(q+8)` is even: `frequency = 10 + (g(q+9) mod 50)`,
  `angle = rotation`, `contrast = 0.15`.
- Band layers get additive noise: `octaves = 6`, `frequency = r3(6 + (S0 mod 16))`,
  `seed = S1 mod 1000`, `amplitude = 0.12`, colour `[1, 1, 0.8]`.

## Rendering

`x = cx + scale (2m + 1 - W) / min(W, H)`, `y = cy + scale (H - 2n - 1) / min(W, H)`
for pixel column `m` and row `n` (row 0 at the top). The canonical image is the
CPU render at 512 x 512; its SHA-256 over the RGBA bytes is the `imageHash`
stored with a mint. The full formula is shown on the block page and can be
regenerated with `paramsToLatex(params)`.
