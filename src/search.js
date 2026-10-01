const http = require("http");
const https = require("https");
const { URL } = require("url");
const { say } = require("./voice");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
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
            resolve(Buffer.concat(chunks).toString("utf8"));
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
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("timeout"));
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
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    if (String(href).startsWith("//")) return "https:" + href;
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

function topicQuery(raw) {
  return String(raw || "")
    .replace(/[¿?¡!]+/g, " ")
    .replace(/^(qué|que|what|who|quién|quien)\s+(es|is|era|was|son|are)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
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
  return results.filter((r) => r.url && /^https?:/i.test(r.url) && !/duckduckgo\.com/i.test(r.url));
}

function parseDdgLite(html, limit) {
  const results = [];
  const re =
    /href="([^"]*uddg=[^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && results.length < limit) {
    const url = cleanUrl(decodeEntities(m[1].replace(/&amp;/g, "&")));
    if (!url || /duckduckgo\.com/i.test(url)) continue;
    results.push({
      url,
      title: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(),
      snippet: "",
    });
  }
  return results;
}

function pushHit(hits, seen, hit) {
  if (!hit || !hit.url || !/^https?:/i.test(hit.url)) return;
  const key = hit.url.replace(/#.*$/, "").replace(/\/$/, "");
  if (seen.has(key)) return;
  seen.add(key);
  hits.push({
    url: hit.url,
    title: hit.title || "",
    snippet: hit.snippet || "",
    body: hit.body || "",
  });
}

async function ddgHtml(query, limit) {
  try {
    const html = await fetchText(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    );
    if (/captcha|anomaly-modal|sorry/i.test(html) && !/result__a/.test(html)) return [];
    return parseDdg(html, limit);
  } catch {
    return [];
  }
}

async function ddgLite(query, limit) {
  try {
    const html = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`);
    return parseDdgLite(html, limit);
  } catch {
    return [];
  }
}

async function ddgInstant(query) {
  const json = await fetchJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1`
  );
  if (!json) return [];
  const hits = [];
  if (json.AbstractText && json.AbstractURL) {
    hits.push({
      title: json.Heading || query,
      snippet: json.AbstractText,
      url: json.AbstractURL,
      body: json.AbstractText,
    });
  }
  const related = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
  for (const t of related) {
    if (t && t.Text && t.FirstURL) {
      hits.push({ title: t.Text.split(" - ")[0], snippet: t.Text, url: t.FirstURL });
    }
    if (t && Array.isArray(t.Topics)) {
      for (const s of t.Topics.slice(0, 3)) {
        if (s && s.Text && s.FirstURL) {
          hits.push({ title: s.Text.split(" - ")[0], snippet: s.Text, url: s.FirstURL });
        }
      }
    }
  }
  return hits;
}

async function wikiSummary(title, lang) {
  const json = await fetchJson(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (!json || json.type === "disambiguation") {
    if (json && json.extract && json.content_urls && json.content_urls.desktop) {
      return {
        title: json.title || title,
        snippet: json.extract,
        body: json.extract,
        url: json.content_urls.desktop.page,
      };
    }
    return null;
  }
  const url =
    (json.content_urls && json.content_urls.desktop && json.content_urls.desktop.page) ||
    json.content_urls?.mobile?.page ||
    `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  if (!json.extract) return null;
  return { title: json.title || title, snippet: json.extract, body: json.extract, url };
}

async function wikiSearch(query, lang) {
  const topic = topicQuery(query) || query;
  const open = await fetchJson(
    `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      topic
    )}&limit=5&namespace=0&format=json`
  );
  const hits = [];
  if (Array.isArray(open) && Array.isArray(open[1])) {
    for (let i = 0; i < open[1].length; i++) {
      hits.push({
        title: open[1][i],
        snippet: (open[2] && open[2][i]) || "",
        url: (open[3] && open[3][i]) || "",
      });
    }
  }
  const summary = await wikiSummary(topic.replace(/\s+/g, "_"), lang);
  if (summary) hits.unshift(summary);
  return hits.filter((h) => h.url);
}

async function searchWeb(query, opts = {}) {
  const { withTimeout } = require("./timeout");
  const q = String(query || "").trim();
  const topic = topicQuery(q) || q;
  const seen = new Set();
  const hits = [];

  const work = (async () => {
    const batches = await Promise.all([
      ddgHtml(q, 8),
      ddgLite(q, 8),
      ddgInstant(topic),
      wikiSearch(topic, "es"),
      wikiSearch(topic, "en"),
    ]);
    for (const part of batches) {
      for (const h of part) pushHit(hits, seen, h);
    }
    const pages = Math.min(opts.pages || 3, hits.length);
    await Promise.all(
      hits.slice(0, pages).map(async (h) => {
        if (h.body && h.body.length > 80) return;
        try {
          const html = await fetchText(h.url);
          h.body = readable(html);
        } catch {
          h.body = h.body || "";
        }
      })
    );
  })();
  await withTimeout(work, 10000, null);
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
      .filter((s) => s.length > 8)
  );
  const joined = blobs.join(" ");
  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 20 && arr.indexOf(s) === i)
    .slice(0, 10);
  const body = sentences.length >= 1 ? sentences.join(" ") : blobs.slice(0, 5).join(" ");
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
  topicQuery,
  parseDdg,
  parseDdgLite,
};
