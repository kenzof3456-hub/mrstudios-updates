const assert = require("assert");
const { readable, cleanUrl, formatSearchAnswer, packWebForLlm } = require("./search");
const { parsePlan } = require("./plan");

assert.strictEqual(
  cleanUrl("https://html.duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.example.com%2Fapi"),
  "https://docs.example.com/api"
);

const text = readable(
  "<html><script>evil()</script><style>p{}</style><p>Electron apps can speak with speechSynthesis after a user gesture.</p>"
);
assert.match(text, /Electron apps can speak/);
assert.doesNotMatch(text, /evil/);

const combined = formatSearchAnswer(
  "electron tts",
  [
    {
      title: "Docs",
      snippet: "Use speechSynthesis after a click. Volume must be 1.",
      body: "Chromium blocks autoplay until the window has a gesture. Pick Alvaro or Ryan.",
      url: "https://docs.example/tts",
    },
    {
      title: "Wiki",
      snippet: "Web Speech API exposes voices via voiceschanged.",
      body: "Empty voices mean wait for voiceschanged then speak.",
      url: "https://wiki.example/speech",
    },
    {
      title: "Guide",
      snippet: "SAPI Volume 100 on Windows desktop apps.",
      url: "https://guide.example/sapi",
    },
  ],
  "en"
);
assert.match(combined, /several public pages/);
assert.match(combined, /Sources:/);
assert.match(combined, /docs\.example\/tts/);
assert.match(combined, /wiki\.example\/speech/);
assert.match(combined, /guide\.example\/sapi/);
assert.match(combined, /autoplay|voiceschanged|Volume/);
assert.ok(combined.length > 160);

const packed = packWebForLlm([
  { title: "A", snippet: "short", body: "page body from first result", url: "https://a.example/" },
  { title: "B", snippet: "also", body: "page body from second result", url: "https://b.example/" },
]);
assert.match(packed, /page body from first/);
assert.match(packed, /https:\/\/b\.example/);

assert.strictEqual(parsePlan('{"action":"answer","query":"quién es"}').need_web, false);
assert.strictEqual(parsePlan('{"action":"datetime"}').need_web, false);
assert.strictEqual(parsePlan('{"action":"search","query":"x"}').need_web, true);

const { topicQuery, searchWeb } = require("./search");
assert.strictEqual(topicQuery("qué es honda"), "honda");
assert.strictEqual(topicQuery("qué es Honda"), "Honda");

(async () => {
  const hits = await searchWeb("honda", { pages: 2 });
  assert.ok(hits.length > 0, "honda should return hits");
  const ans = formatSearchAnswer("honda", hits, "es");
  assert.doesNotMatch(ans, /nada sólido/);
  assert.match(ans, /Honda|honda|Fuentes|wikipedia/i);
  const hits2 = await searchWeb("qué es honda", { pages: 2 });
  assert.ok(hits2.length > 0, "qué es honda should return hits");
  const ans2 = formatSearchAnswer("qué es honda", hits2, "es");
  assert.doesNotMatch(ans2, /nada sólido/);
  console.log("search ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
