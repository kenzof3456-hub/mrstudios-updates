const fs = require("fs");
const path = require("path");

function createMemory(filePath) {
  const store = { facts: [] };

  function read() {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        store.facts = Array.isArray(parsed.facts) ? parsed.facts : [];
      }
    } catch {
      store.facts = [];
    }
  }

  function write() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ facts: store.facts }, null, 2), "utf8");
  }

  read();

  function normalizeFact(text) {
    return String(text || "")
      .replace(/^(que |el hecho de que )/i, "")
      .replace(/[?.!]+$/g, "")
      .trim();
  }

  function add(raw) {
    const text = normalizeFact(raw);
    if (!text) return null;
    const dup = store.facts.find(
      (f) => f.text.toLowerCase() === text.toLowerCase()
    );
    if (dup) return dup;
    const fact = {
      id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      at: new Date().toISOString(),
    };
    store.facts.push(fact);
    write();
    return fact;
  }

  function list() {
    return [...store.facts];
  }

  function forget(query) {
    const q = String(query || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
    if (!q) return [];
    const kept = [];
    const removed = [];
    for (const f of store.facts) {
      const hay = f.text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      if (hay.includes(q) || f.id === query) removed.push(f);
      else kept.push(f);
    }
    store.facts = kept;
    write();
    return removed;
  }

  function forgetAll() {
    const n = store.facts.length;
    store.facts = [];
    write();
    return n;
  }

  function contextBlock() {
    if (!store.facts.length) return "Aún no hay recuerdos extra de Rabbit.";
    return store.facts.map((f, i) => `${i + 1}. ${f.text}`).join("\n");
  }

  function relatedTo(text) {
    const t = String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (!t) return [];
    return store.facts.filter((f) => {
      const words = f.text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .split(/\W+/)
        .filter((w) => w.length > 3);
      return words.some((w) => t.includes(w));
    });
  }

  return { add, list, forget, forgetAll, contextBlock, relatedTo, filePath };
}

module.exports = { createMemory };
