const https = require("https");
const { URL } = require("url");

function chatWithLlm({ apiKey, baseUrl, model, messages }) {
  if (!apiKey) return Promise.resolve(null);
  const root = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = new URL(`${root}/chat/completions`);
  const body = JSON.stringify({
    model: model || "gpt-4o-mini",
    temperature: 0.4,
    messages,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const text = json.choices?.[0]?.message?.content;
            resolve(text || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(25000, () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

module.exports = { chatWithLlm };
