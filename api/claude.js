function extractImageUrl(html) {
  // og:image
  const og = html.match(/<meta[^>]+property="og:image[^"]*"[^>]+content="([^"]+)"/i) ||
              html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image/i);
  if (og) return og[1];
  // twitter:image
  const tw = html.match(/<meta[^>]+name="twitter:image[^"]*"[^>]+content="([^"]+)"/i) ||
              html.match(/<meta[^>]+content="([^"]+)"[^>]+name="twitter:image/i);
  if (tw) return tw[1];
  // JSON-LD schema image
  const ld = html.match(/"image"\s*:\s*"(https?:[^"]+)"/i) ||
              html.match(/"image"\s*:\s*\[\s*"(https?:[^"]+)"/i) ||
              html.match(/"image"\s*:\s*\{\s*"url"\s*:\s*"(https?:[^"]+)"/i);
  if (ld) return ld[1];
  // First large img src (skip icons/logos/trackers)
  const imgs = [...html.matchAll(/<img[^>]+src="(https?[^"]+)"/gi)];
  for (const m of imgs) {
    const src = m[1];
    if (!src.match(/logo|icon|sprite|banner|header|pixel|tracking|1x1|badge|avatar/i) &&
        src.match(/\.(jpg|jpeg|png|webp)/i)) return src;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { fetchUrl, ...claudeBody } = req.body;
    if (fetchUrl) {
      try {
        const pageRes = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(8000),
        });
        const html = await pageRes.text();
        const stripped = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000);

        const imageUrl = extractImageUrl(html);

        const pricePatterns = [
          /"price":\s*"(\d+\.?\d*)"/i,
          /"price":\s*(\d+\.?\d*)(?:[,\s}])/i,
          /data-price="(\d+\.?\d*)"/i,
          /itemprop="price"[^>]*content="([^"]+)"/i,
          /content="([^"]+)"[^>]*itemprop="price"/i,
          /["']price["'][^>]*["'](\d+\.?\d*)["']/i,
          /\$\s*(\d{1,4}(?:\.\d{2})?)/,
        ];
        let price = null;
        for (const p of pricePatterns) {
          const m = html.match(p);
          if (m && parseFloat(m[1]) > 0 && parseFloat(m[1]) < 10000) { price = m[1]; break; }
        }

        let imageData = null;
        if (imageUrl) {
          try {
            const imgRes = await fetch(imageUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
              signal: AbortSignal.timeout(5000),
            });
            if (imgRes.ok) {
              const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
              if (contentType.startsWith('image/')) {
                const buf = await imgRes.arrayBuffer();
                imageData = `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`;
              }
            }
          } catch {}
        }
        return res.status(200).json({ pageText: stripped, imageUrl, imageData, price });
      } catch (err) {
        return res.status(200).json({ pageText: '', imageUrl: null, imageData: null, price: null, error: err.message });
      }
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeBody),
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
