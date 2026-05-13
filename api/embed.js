export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  if (!resp.ok) {
    return res.status(502).json({ error: "OpenAI error", detail: await resp.text() });
  }

  const data = await resp.json();
  return res.status(200).json({ embedding: data.data[0].embedding });
}
