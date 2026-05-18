import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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
  // First large img src or data-src (lazy-loaded), or first srcset URL
  const imgPatterns = [
    /<img[^>]+src="(https?[^"]+)"/gi,
    /<img[^>]+data-src="(https?[^"]+)"/gi,
    /<img[^>]+srcset="(https?[^\s,"]+)/gi,
  ];
  for (const pattern of imgPatterns) {
    const imgs = [...html.matchAll(pattern)];
    for (const m of imgs) {
      const src = m[1];
      if (!src.match(/logo|icon|sprite|banner|header|pixel|tracking|1x1|badge|avatar/i) &&
          src.match(/\.(jpg|jpeg|png|webp)/i)) return src;
    }
  }
  return null;
}

function isPrivateIp(host) {
  const version = isIP(host);
  if (version === 4) {
    const parts = host.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      host === "0.0.0.0"
    );
  }
  if (version === 6) {
    const normalized = host.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }
  return false;
}

async function validateFetchUrl(fetchUrl, baseUrl = undefined) {
  let parsedUrl;
  try {
    parsedUrl = new URL(fetchUrl, baseUrl);
  } catch {
    return { error: "invalid fetchUrl" };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return { error: "fetchUrl must be http or https" };
  }

  const host = parsedUrl.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || isPrivateIp(host)) {
    return { error: "fetchUrl host is not allowed" };
  }

  try {
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
      return { error: "fetchUrl host is not allowed" };
    }
  } catch {
    return { error: "could not resolve fetchUrl host" };
  }

  return { url: parsedUrl.toString() };
}

async function safeFetch(url, options = {}, maxRedirects = 3) {
  let currentUrl = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const r = await fetch(currentUrl, { ...options, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(r.status)) return r;

    const location = r.headers.get("location");
    if (!location) return r;

    const nextUrl = await validateFetchUrl(location, currentUrl);
    if (nextUrl.error) throw new Error(nextUrl.error);
    currentUrl = nextUrl.url;
  }
  throw new Error("too many redirects");
}

async function fetchPageHtml(url) {
  // 0. ScrapingBee — handles JS-rendered pages
  if (process.env.SCRAPINGBEE_API_KEY) {
    try {
      const sbUrl = 'https://app.scrapingbee.com/api/v1/?' + new URLSearchParams({
        api_key: process.env.SCRAPINGBEE_API_KEY,
        url: url,
        render_js: 'true',
        premium_proxy: 'false',
      });
      const r = await safeFetch(sbUrl, { signal: AbortSignal.timeout(10000) });
      if (r.ok) return await r.text();
    } catch {}
  }

  // 1. Direct fetch with mobile UA
  try {
    const r = await safeFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) return await r.text();
  } catch {}

  // 2. corsproxy.io
  try {
    const r = await safeFetch('https://corsproxy.io/?' + encodeURIComponent(url), {
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) return await r.text();
  } catch {}

  // 3. allorigins.win
  try {
    const r = await safeFetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url), {
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.contents) return j.contents;
    }
  } catch {}

  return null;
}

// Validate a Claude API request body has the expected shape
function validateClaudeBody(body) {
  if (!body || typeof body !== 'object') return 'request body must be an object';
  if (!Array.isArray(body.messages) || body.messages.length === 0) return 'messages must be a non-empty array';
  if (body.messages.length > 50) return 'too many messages';
  if (typeof body.model !== 'string' || !body.model.startsWith('claude-')) return 'invalid model';
  if (body.max_tokens !== undefined && (typeof body.max_tokens !== 'number' || body.max_tokens < 1 || body.max_tokens > 8192)) return 'invalid max_tokens';
  for (const msg of body.messages) {
    if (!['user', 'assistant'].includes(msg.role)) return 'invalid message role';
    if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) return 'invalid message content';
  }
  return null;
}

function trimClaudeMessages(body, maxMessages = 30) {
  if (!Array.isArray(body?.messages) || body.messages.length <= maxMessages) return body;
  return {
    ...body,
    messages: body.messages.slice(-maxMessages),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'invalid request body' });
    }

    const { fetchUrl, ...rawClaudeBody } = req.body;
    const claudeBody = trimClaudeMessages(rawClaudeBody);

    if (fetchUrl) {
      const safeUrl = await validateFetchUrl(fetchUrl);
      if (safeUrl.error) return res.status(400).json({ error: safeUrl.error });

      try {
        const html = await fetchPageHtml(safeUrl.url);
        if (!html) {
          return res.status(200).json({ pageText: '', imageUrl: null, imageData: null, price: null, fetchStatus: 0 });
        }

        const stripped = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 10000);

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
              signal: AbortSignal.timeout(2000),
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
        console.error('[api/claude] fetchUrl error:', err.message);
        return res.status(200).json({ pageText: '', imageUrl: null, imageData: null, price: null, error: err.message });
      }
    }

    // Claude API proxy — validate before forwarding
    const validationError = validateClaudeBody(claudeBody);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[api/claude] ANTHROPIC_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const hasImage = claudeBody.messages.some(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === "image")
    );
    if (hasImage) {
      claudeBody.model = "claude-sonnet-4-6";
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeBody),
    });
    const data = await response.json();
    if (data.error) console.error('[api/claude] Anthropic error:', data.error);
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    console.error('[api/claude] top-level error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
