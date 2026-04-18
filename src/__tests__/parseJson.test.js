import { describe, it, expect } from "vitest";
import { parseJsonObject, parseJsonArray } from "../utils/parseJson.js";

// ── parseJsonObject ───────────────────────────────────────────────────────────

describe("parseJsonObject", () => {
  it("parses a plain JSON object string", () => {
    const result = parseJsonObject('{"name":"Shirt","color":"Blue"}');
    expect(result).toEqual({ name: "Shirt", color: "Blue" });
  });

  it("strips markdown json code fences", () => {
    const text = '```json\n{"name":"Jeans"}\n```';
    expect(parseJsonObject(text)).toEqual({ name: "Jeans" });
  });

  it("strips bare triple-backtick fences", () => {
    const text = "```\n{\"color\":\"Red\"}\n```";
    expect(parseJsonObject(text)).toEqual({ color: "Red" });
  });

  it("ignores leading prose before the JSON object", () => {
    const text = "Here is the extracted data:\n\n{\"brand\":\"Everlane\"}";
    expect(parseJsonObject(text)).toEqual({ brand: "Everlane" });
  });

  it("ignores trailing prose after the JSON object", () => {
    const text = '{"price":89} Let me know if you need anything else.';
    expect(parseJsonObject(text)).toEqual({ price: 89 });
  });

  it("handles nested objects", () => {
    const text = '{"item":{"name":"Coat","tags":["Formal"]}}';
    expect(parseJsonObject(text)).toEqual({ item: { name: "Coat", tags: ["Formal"] } });
  });

  it("throws SyntaxError when no object braces found", () => {
    expect(() => parseJsonObject("just some text")).toThrow(SyntaxError);
    expect(() => parseJsonObject("just some text")).toThrow("No JSON object found");
  });

  it("throws on invalid JSON even if braces are present", () => {
    expect(() => parseJsonObject("{bad json here}")).toThrow();
  });

  it("handles object with empty fields", () => {
    expect(parseJsonObject('{"name":"","price":null}')).toEqual({ name: "", price: null });
  });
});

// ── parseJsonArray ────────────────────────────────────────────────────────────

describe("parseJsonArray", () => {
  it("parses a plain JSON array string", () => {
    expect(parseJsonArray('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it("strips markdown json code fences", () => {
    const text = '```json\n["a","b"]\n```';
    expect(parseJsonArray(text)).toEqual(["a", "b"]);
  });

  it("strips bare triple-backtick fences", () => {
    const text = '```\n["x"]\n```';
    expect(parseJsonArray(text)).toEqual(["x"]);
  });

  it("ignores leading prose before the array", () => {
    const text = 'Here are the items:\n["Shirt","Jeans"]';
    expect(parseJsonArray(text)).toEqual(["Shirt", "Jeans"]);
  });

  it("handles array of objects", () => {
    const text = '[{"name":"Shirt"},{"name":"Pants"}]';
    expect(parseJsonArray(text)).toEqual([{ name: "Shirt" }, { name: "Pants" }]);
  });

  it("throws SyntaxError when no array brackets found", () => {
    expect(() => parseJsonArray("no brackets here")).toThrow(SyntaxError);
    expect(() => parseJsonArray("no brackets here")).toThrow("No JSON array found");
  });

  it("handles empty array", () => {
    expect(parseJsonArray("[]")).toEqual([]);
  });

  it("handles array with prose before and after", () => {
    const text = 'I found these items: ["Coat", "Boots"] Hope that helps!';
    expect(parseJsonArray(text)).toEqual(["Coat", "Boots"]);
  });
});
