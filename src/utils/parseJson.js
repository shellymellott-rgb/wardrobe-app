/**
 * Strip markdown fences and extract the first complete JSON object from text.
 * Returns the parsed value or throws on failure.
 */
export function parseJsonObject(text) {
  const clean = text.replace(/```json|```/gi, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new SyntaxError("No JSON object found in response");
  return JSON.parse(clean.substring(start, end + 1));
}

/**
 * Strip markdown fences and extract the first complete JSON array from text.
 * Returns the parsed value or throws on failure.
 */
export function parseJsonArray(text) {
  const clean = text.replace(/```json|```/gi, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1) throw new SyntaxError("No JSON array found in response");
  return JSON.parse(clean.substring(start, end + 1));
}
