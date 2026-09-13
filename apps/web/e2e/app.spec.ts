import { expect, test, type Page } from "@playwright/test";
import { Keypair } from "@solana/web3.js";

// True when the canvas has at least two distinct colours, i.e. WebGL drew.
async function canvasHasContent(page: Page, index = 0) {
  return page.evaluate((i) => {
    const c = document.querySelectorAll<HTMLCanvasElement>("canvas[data-testid=formula-canvas]")[i];
    if (!c) return false;
    const gl = c.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return false;
    const px = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const seen = new Set<number>();
    for (let k = 0; k < px.length; k += 4 * 97) seen.add(px[k] | (px[k + 1] << 8) | (px[k + 2] << 16));
    return seen.size > 1;
  }, index);
}

test("home shows the three engine presets", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /formulas/ })).toBeVisible();
  await expect(page.locator("canvas[data-testid=formula-canvas]")).toHaveCount(4);
  expect(await canvasHasContent(page, 0)).toBe(true);
});

test("genesis block renders with data and formula", async ({ page }) => {
  await page.goto("/block?slot=genesis");
  await expect(page.getByText("4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn")).toBeVisible();
  await expect(page.getByText("Layers derived")).toBeVisible();
  expect(await canvasHasContent(page)).toBe(true);
  await page.getByRole("button", { name: "Formula" }).click();
  await expect(page.locator(".katex").first()).toBeVisible();
  await page.getByRole("button", { name: "Parameters" }).click();
  await expect(page.getByTestId("params-json")).toContainText('"version": 1');
});

test("missing slot shows an error", async ({ page }) => {
  await page.goto("/block?slot=999");
  await expect(page.getByTestId("block-error")).toBeVisible();
});

test("slot form navigates", async ({ page }) => {
  await page.goto("/block");
  await page.getByTestId("slot-input").fill("14");
  await page.getByRole("button", { name: "Render", exact: true }).click();
  await expect(page).toHaveURL(/slot=14/);
  await expect(page.getByText("Slot", { exact: true })).toBeVisible();
});

test("gallery lists recent slots", async ({ page }) => {
  await page.goto("/gallery");
  const cards = page.getByTestId("gallery-grid").locator("a");
  await expect(cards).toHaveCount(8);
  await expect(cards.first()).toContainText("Slot 1000");
});

test("block api and render api respond", async ({ request }) => {
  const res = await request.get("/api/block/0");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.params.layers.length).toBe(1);
  const png = await request.get("/api/render?slot=0&size=64");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  expect(png.headers()["x-image-hash"]).toMatch(/^[0-9a-f]{64}$/);
  const again = await request.get("/api/render?slot=0&size=64");
  expect(again.headers()["x-image-hash"]).toBe(png.headers()["x-image-hash"]);
});

test("create page generates from text with the mock model and re-renders on edit", async ({ page }) => {
  await page.goto("/create");
  await page.getByTestId("description").fill("a flower");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("param-editor")).toBeVisible();
  expect(await canvasHasContent(page)).toBe(true);
  const before = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-testid=formula-canvas]")!;
    return c.toDataURL();
  });
  const slider = page.getByTestId("param-editor").locator("input[type=range]").nth(1);
  await slider.fill("3");
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-testid=formula-canvas]")!;
    return c.toDataURL();
  });
  expect(after).not.toBe(before);
});

test("create page rejects an empty description", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByTestId("generate")).toBeDisabled();
});

test("mint api enforces one mint per slot", async ({ request }) => {
  const owner = Keypair.generate().publicKey.toBase58();
  // Mock RPC skips slots divisible by 3; pick one it serves.
  const slot = 3 * (1 + Math.floor(Math.random() * 300)) + 1;
  const body = { kind: "block", slot, owner, network: "devnet" };
  const first = await request.post("/api/mint", { data: body });
  if (first.status() === 500) test.skip(true, "database not available");
  expect(first.status()).toBe(200);
  const json = await first.json();
  expect(json.dummy).toBe(true);
  const second = await request.post("/api/mint", { data: body });
  expect(second.status()).toBe(409);
  const mainnet = await request.post("/api/mint", { data: { ...body, network: "mainnet-beta" } });
  expect(mainnet.status()).toBe(403);
});
