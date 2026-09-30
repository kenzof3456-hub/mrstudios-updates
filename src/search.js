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
          "User-Agent": "Jarvis/1.0 (desktop assistant for Rabbit)",
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

function formatSearchAnswer(query, results) {
  if (!results.length) {
    return say(
      "¡Rayos!",
      `Busqué «${query}» y la red no me dio nada.`,
      "¿Otras palabras, Rabbit?"
    );
  }
  const lines = results.slice(0, 3).map((r, i) => `${i + 1}. ${r.snippet || r.title}`);
  const cites = results
    .slice(0, 3)
    .map((r) => r.url)
    .join(" · ");
  return say(
    "¡Buena pregunta, Rabbit!",
    `Esto pesqué sobre «${query}»:\n${lines.join("\n")}`,
    `Fuentes: ${cites}`
  );
}

module.exports = { searchWeb, formatSearchAnswer };
