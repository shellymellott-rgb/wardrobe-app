export async function callClaude(system, userContent, maxTokens = 1000) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = typeof data.error === "object" ? data.error?.message : (data.error || `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data.content?.[0]?.text || "";
}
