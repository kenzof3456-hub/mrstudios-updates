const http = require("http");
const https = require("https");
const { URL } = require("url");
const { say } = require("./voice");

function fetchText(urlString, maxBytes = 350000, hops = 0) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      reject(new Error("bad-url"));
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      reject(new Error("skip-proto"));
      return;
    }
    const lib = url.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent": "Jarvis/1.0 (desktop assistant for Señor)",
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          if (hops > 4) {
            reject(new Error("redirects"));
            return;
          }
          fetchText(next, maxBytes, hops + 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("timeout"));
    });
    req.end();
  });
}

function fetchJson(urlString) {
  return fetchText(urlString)
    .then((body) => {
      try {
        return JSON.parse(body);
      } catch {
        return null;
      }
    })
    .catch(() => null);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<\/?b>/gi, "");
}

function cleanUrl(href) {
  try {
    const u = new URL(href, "https://html.duckduckgo.com/");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return u.toString();
  } catch {
    return href;
  }
}

function readable(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  )
    .trim()
    .slice(0, 1800);
}

function parseDdg(html, limit) {
  const results = [];
  const re =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && results.length < limit) {
    results.push({
      url: cleanUrl(decodeEntities(m[1])),
      title: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(),
      snippet: decodeEntities(m[3].replace(/<[^>]+>/g, "")).trim(),
    });
  }
  if (results.length === 0) {
    const loose =
      /uddg=([^&"]+)[\s\S]{0,200}?class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)</gi;
    let n;
    while ((n = loose.exec(html)) && results.length < limit) {
      results.push({
        url: decodeURIComponent(n[1]),
        title: decodeEntities(n[2].replace(/<[^>]+>/g, "")).trim(),
        snippet: decodeEntities(n[3].replace(/<[^>]+>/g, "")).trim(),
      });
    }
  }
  return results.filter((r) => r.url && /^https?:/i.test(r.url) && !/duckduckgo\.com/i.test(r.url));
}

async function ddgQuery(query, limit = 8) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const html = await fetchText(url);
    return parseDdg(html, limit);
  } catch {
    return [];
  }
}

async function searchWeb(query, opts = {}) {
  const deep = opts.deep !== false;
  const variants = [String(query || "").trim()].filter(Boolean);
  if (deep && variants[0]) {
    variants.push(variants[0] + " wikipedia");
    variants.push(variants[0] + " documentation overview");
  }
  const seen = new Set();
  const hits = [];
  for (const v of variants) {
    const part = await ddgQuery(v, 8);
    for (const h of part) {
      const key = h.url.replace(/#.*$/, "").replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(h);
    }
  }
  const pages = Math.min(opts.pages || 4, hits.length);
  await Promise.all(
    hits.slice(0, pages).map(async (h) => {
      try {
        const html = await fetchText(h.url);
        h.body = readable(html);
      } catch {
        h.body = "";
      }
    })
  );
  return hits.slice(0, 8);
}

function formatSearchAnswer(query, results, lang = "es") {
  if (!results.length) {
    return say(
      lang === "en"
        ? `I searched several pages for «${query}» and nothing solid came back.`
        : `Busqué varias páginas sobre «${query}» y no llegó nada sólido.`
    );
  }
  const blobs = results.flatMap((r) =>
    [r.title, r.snippet, r.body]
      .map((s) => String(s || "").replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 24)
  );
  const joined = blobs.join(" ");
  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 32 && arr.indexOf(s) === i)
    .slice(0, 10);
  const body = sentences.length >= 2 ? sentences.join(" ") : blobs.slice(0, 5).join(" ");
  const cites = results
    .slice(0, 5)
    .map((r) => r.url)
    .filter(Boolean)
    .join(" · ");
  return say(
    lang === "en"
      ? `Combined from several public pages on «${query}»:`
      : `Combiné varias páginas públicas sobre «${query}»:`,
    body.slice(0, 2200),
    cites ? (lang === "en" ? `Sources: ${cites}` : `Fuentes: ${cites}`) : ""
  );
}

function packWebForLlm(results) {
  if (!results || !results.length) return "(none)";
  return results
    .slice(0, 6)
    .map((r, i) => {
      const extra = r.body ? `\n${r.body.slice(0, 900)}` : "";
      return `${i + 1}. ${r.title}\n${r.snippet || ""}${extra}\n${r.url}`;
    })
    .join("\n\n");
}

module.exports = {
  searchWeb,
  formatSearchAnswer,
  fetchText,
  fetchJson,
  readable,
  packWebForLlm,
  cleanUrl,
};
