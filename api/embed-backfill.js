import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: rows, error: loadErr } = await supabase
    .from("wardrobe_items")
    .select("id, data")
    .eq("user_id", userId)
    .is("embedding", null);

  if (loadErr) return res.status(500).json({ error: loadErr.message });

  let processed = 0;
  const errors = [];

  for (const row of rows) {
    const d = row.data || {};
    const material = Array.isArray(d.materials)
      ? d.materials.join(" ")
      : (d.material || d.materials || "");
    const text = [d.name, d.brand, d.category, d.color, material, d.season]
      .filter(Boolean).join(" ").trim();

    if (!text) continue;

    try {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      });

      if (!resp.ok) {
        errors.push({ id: row.id, error: await resp.text() });
        continue;
      }

      const embedding = (await resp.json()).data[0].embedding;

      const { error: updateErr } = await supabase
        .from("wardrobe_items")
        .update({ embedding })
        .eq("id", row.id)
        .eq("user_id", userId);

      if (updateErr) errors.push({ id: row.id, error: updateErr.message });
      else processed++;
    } catch (e) {
      errors.push({ id: row.id, error: e.message });
    }
  }

  return res.status(200).json({ processed, errors });
}
