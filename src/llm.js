const https = require("https");
const { URL } = require("url");

function postChat({ apiKey, baseUrl, model, messages, timeout = 45000 }) {
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
            resolve(json.choices?.[0]?.message?.content || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

function chatWithLlm({ apiKey, baseUrl, model, messages }) {
  return postChat({ apiKey, baseUrl, model, messages, timeout: 25000 });
}

function visionRead({ apiKey, baseUrl, model, dataUrl, prompt }) {
  if (!apiKey || !dataUrl) return Promise.resolve(null);
  return postChat({
    apiKey,
    baseUrl,
    model: model || "gpt-4o-mini",
    timeout: 45000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
}

module.exports = { chatWithLlm, visionRead };
