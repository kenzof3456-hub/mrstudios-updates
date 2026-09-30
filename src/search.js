const https = require("https");
const { URL } = require("url");
const { say } = require("./voice");

function fetchText(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent": "Jarvis/1.0 (desktop assistant for Señor)",
          Accept: "text/html,application/json",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchText(new URL(res.headers.location, url).toString()).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
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
    req.setTimeout(15000, () => {
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

function searchWeb(query) {
  const q = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;
  return fetchText(url)
    .then((html) => {
      const results = [];
      const re =
        /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = re.exec(html)) && results.length < 5) {
        results.push({
          url: decodeEntities(m[1]),
          title: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(),
          snippet: decodeEntities(m[3].replace(/<[^>]+>/g, "")).trim(),
        });
      }
      if (results.length === 0) {
        const loose =
          /uddg=([^&"]+)[\s\S]{0,200}?class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)</gi;
        let n;
        while ((n = loose.exec(html)) && results.length < 5) {
          results.push({
            url: decodeURIComponent(n[1]),
            title: decodeEntities(n[2].replace(/<[^>]+>/g, "")).trim(),
            snippet: decodeEntities(n[3].replace(/<[^>]+>/g, "")).trim(),
          });
        }
      }
      return results;
    })
    .catch(() => []);
}

function formatSearchAnswer(query, results, lang = "es") {
  if (!results.length) {
    return say(
      lang === "en"
        ? `I searched for «${query}» and nothing solid came back. Try a narrower wording.`
        : `Busqué «${query}» y no llegó nada sólido. Prueba con otras palabras.`
    );
  }
  const blobs = results
    .map((r) => (r.snippet || r.title || "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 20);
  const joined = blobs.join(" ");
  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 28 && arr.indexOf(s) === i)
    .slice(0, 6);
  const body =
    sentences.length >= 2
      ? sentences.join(" ")
      : blobs.slice(0, 3).join(" ");
  const cites = results
    .slice(0, 3)
    .map((r) => r.url)
    .filter(Boolean)
    .join(" · ");
  return say(
    lang === "en"
      ? `Here's what I can put together on «${query}», from public sources:`
      : `Esto es lo que puedo armar sobre «${query}», con fuentes públicas:`,
    body,
    cites
      ? lang === "en"
        ? `Sources: ${cites}`
        : `Fuentes: ${cites}`
      : ""
  );
}

module.exports = { searchWeb, formatSearchAnswer, fetchText, fetchJson };
