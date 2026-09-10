import { describe, expect, it } from "vitest";
import { presets, ParamsSchema } from "@slotart/engine";
import { SCHEMA_GUIDE, extractJson, generateParams, mockCaller } from "./llm";

describe("llm helpers", () => {
  it("extracts json from fenced replies", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a":{"b":2}} trailing')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("nothing")).toThrow();
  });
  it("mentions every top-level schema key in the guide", () => {
    for (const key of Object.keys(ParamsSchema.shape)) expect(SCHEMA_GUIDE).toContain(`"${key}"`);
  });
  it("retries until the model returns valid params", async () => {
    let calls = 0;
    const caller = async () => {
      calls++;
      if (calls === 1) return "not json at all";
      if (calls === 2) return JSON.stringify({ version: 1, view: {}, background: { top: [9, 0, 0], bottom: [0, 0, 0] }, layers: [] });
      return JSON.stringify(presets.sky);
    };
    const r = await generateParams({ mode: "text", text: "a sky" }, caller);
    expect(r.attempts).toBe(3);
    expect(r.params.title).toBe(presets.sky.title);
  });
  it("gives up after three invalid replies", async () => {
    await expect(generateParams({ mode: "text", text: "x" }, async () => "{}")).rejects.toThrow(/invalid parameters/);
  });
  it("mock caller returns valid params", async () => {
    const r = await generateParams({ mode: "text", text: "a red flower" }, mockCaller);
    expect(r.params.layers.length).toBeGreaterThan(0);
  });
});
