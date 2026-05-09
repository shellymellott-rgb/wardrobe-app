import { removeBackground } from "@imgly/background-removal-node";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: "No image data provided" });

    // Convert base64 data URL to buffer
    const base64 = imageData.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    const blob = new Blob([buffer], { type: "image/jpeg" });

    // Remove background
    const resultBlob = await removeBackground(blob);
    const arrayBuffer = await resultBlob.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString("base64");
    const resultDataUrl = `data:image/png;base64,${resultBase64}`;

    res.status(200).json({ result: resultDataUrl });
  } catch (e) {
    console.error("[removebg] error:", e.message);
    res.status(500).json({ error: e.message || "Background removal failed" });
  }
}
