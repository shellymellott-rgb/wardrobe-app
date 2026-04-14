export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { fetchUrl, ...claudeBody } = req.body;
    if (fetchUrl) {
      try {
        const pageRes = await fetch(fetchUrl, {
          headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15','Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},
          signal: AbortSignal.timeout(8000),
        });
        const html = await pageRes.text();
        const stripped = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().substring(0,8000);
        const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)||html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
        const imageUrl = ogImageMatch ? ogImageMatch[1] : null;
        const priceMatch = html.match(/["']price["'][^>]*["'](\d+\.?\d*)["']/i)||html.match(/\$(\d+\.?\d*)/);
        const price = priceMatch ? priceMatch[1] : null;
        let imageData = null;
        if (imageUrl) {
          try {
            const imgRes = await fetch(imageUrl, {
              headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'},
              signal: AbortSignal.timeout(5000),
            });
            const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
            const buf = await imgRes.arrayBuffer();
            imageData = `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`;
          } catch {}
        }
        return res.status(200).json({pageText:stripped,imageUrl,imageData,price});
      } catch(err) {
        return res.status(200).json({pageText:'',imageUrl:null,price:null,error:err.message});
      }
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-api-key':process.env.VITE_ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body: JSON.stringify(claudeBody),
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch(err) {
    res.status(500).json({error:err.message});
  }
}
