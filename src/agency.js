const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { writeCraftFile, getLastFiles } = require("./craft");

function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const DO_PREFIX =
  /^(hazmelo|hazme lo|hazme( esto| eso)?|do this|do it|just do (this|it)|ejecutalo|ejecuta( lo| esto)?|run it|run this|hazlo)(\s+|$)/i;

function peelDoIt(raw) {
  const original = String(raw || "").trim();
  const t = nrm(original);
  if (!DO_PREFIX.test(t)) return { execute: false, rest: original, bare: false };
  const rest = original
    .replace(
      /^(házmelo|hazmelo|hazme lo|hazme esto|hazme eso|hazme|do this|do it|just do this|just do it|ejecútalo|ejecutalo|ejecuta lo|ejecuta esto|ejecuta|run it|run this|házlo|hazlo)\s*/i,
      ""
    )
    .trim();
  const restN = nrm(rest);
  if (!restN || /^(esto|eso|lo)$/.test(restN)) {
    return { execute: true, rest: "", bare: true };
  }
  return { execute: true, rest, bare: false };
}

function isWipe(raw) {
  const t = nrm(raw);
  return /(formate(ar|a) (el )?(disco|disco duro|unidad)|format [c-z]:|diskpart|rm -rf\s+\/($|\s)|del \/s \/q [c-z]:|wipe (disk|disco)|factory reset|restablecer (el )?sistema|mkfs|cipher \/w|bcdedit|eliminar windows|destroy (the )?(os|system))/.test(
    t
  );
}

function isDestructive(raw) {
  const t = nrm(raw);
  if (isWipe(t)) return true;
  return /(borra(r)? (el |los |la |las )?(archivo|carpeta|directorio)|delete (the )?(file|folder)|uninstall|desinstala|npm i(nstall)? |pip install |descarga(r)? .*\.(exe|msi|bat)|instala(r)? (este|un) (exe|programa desconocido))/.test(
    t
  );
}

function looksLikeConfirm(raw) {
  return /^(si|yes|dale|hazlo|ok|okay|confirmo|adelante|hazmelo|do it)(\s|$)/.test(nrm(raw));
}

function looksLikeCancel(raw) {
  return /^(no|cancelar|cancela|olvidalo|stop)(\s|$)/.test(nrm(raw));
}

let lastJob = null;
let pendingDanger = null;

function setLastJob(job) {
  lastJob = job || null;
  return lastJob;
}
function getLastJob() {
  return lastJob;
}
function setPendingDanger(job) {
  pendingDanger = job || null;
  return pendingDanger;
}
function getPendingDanger() {
  return pendingDanger;
}
function clearPendingDanger() {
  pendingDanger = null;
}

function consumeConfirm(raw) {
  if (!pendingDanger) return null;
  if (looksLikeCancel(raw)) {
    const was = pendingDanger;
    pendingDanger = null;
    return { type: "agency_cancel", query: was.query };
  }
  if (looksLikeConfirm(raw)) {
    const was = pendingDanger;
    pendingDanger = null;
    return { ...was, execute: true, confirmed: true };
  }
  return null;
}

function writeAll(dir, files) {
  if (!dir || !files || !files.length) return [];
  return files.map((f) => writeCraftFile(dir, f));
}

function looksLongRunning(filePath, content) {
  const blob = `${filePath}\n${content || ""}`;
  return /(discord|client\.login|bot\.run|createServer|app\.listen|while\s*\(\s*true|setInterval)/i.test(
    blob
  );
}

function runFile(filePath) {
  return new Promise((resolve) => {
    const dest = path.resolve(filePath);
    const ext = path.extname(dest).toLowerCase();
    const cmd = ext === ".py" ? "python3" : ext === ".js" || ext === ".mjs" ? "node" : null;
    if (!cmd) {
      resolve({ ok: false, detail: "Solo ejecuto .js / .py locales." });
      return;
    }
    const child = spawn(cmd, [dest], {
      cwd: path.dirname(dest),
      env: { ...process.env, DISCORD_TOKEN: "" },
    });
    let out = "";
    let err = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      finish({ ok: false, detail: "timeout 8s", code: null });
    }, 8000);
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => finish({ ok: false, detail: e.message }));
    child.on("close", (code) => {
      finish({
        ok: code === 0,
        detail: (out || err || `exit ${code}`).trim().slice(0, 800),
        code,
      });
    });
  });
}

function formatRunLines(lang, saved, ran) {
  const head =
    lang === "en" ? "Done. Wrote:\n" + saved.join("\n") : "Hecho. Escrito:\n" + saved.join("\n");
  if (!ran || !ran.length) return head;
  const bits = ran.map((r) => {
    if (r.skipped) {
      return lang === "en"
        ? `Left ${path.basename(r.dest)} on disk (long-running). Run it yourself.`
        : `Dejé ${path.basename(r.dest)} en disco (proceso largo). Ábrelo tú.`;
    }
    const tag = r.ok ? (lang === "en" ? "ran" : "ejecuté") : lang === "en" ? "failed" : "falló";
    const detail = r.detail ? ` — ${r.detail}` : "";
    return `${tag} ${path.basename(r.dest)}${detail}`;
  });
  return head + "\n" + bits.join("\n");
}

async function runSaved(saved, files) {
  const ran = [];
  for (let i = 0; i < saved.length; i++) {
    const dest = saved[i];
    const content = files && files[i] ? files[i].content : "";
    if (!dest || !/\.(js|mjs|py)$/i.test(dest)) continue;
    if (looksLongRunning(dest, content)) {
      ran.push({ dest, skipped: true });
      continue;
    }
    const r = await runFile(dest);
    ran.push({ dest, ...r });
  }
  return ran;
}

async function executeLast(craftDir, lang) {
  const files = getLastFiles();
  if (files.length && craftDir) {
    const saved = writeAll(craftDir, files);
    const ran = await runSaved(saved, files);
    setLastJob({ type: "craft", saved, files, ran });
    return {
      reply: formatRunLines(lang, saved, ran),
      saved,
      ran,
    };
  }
  if (lastJob && lastJob.type === "open_app" && lastJob.app) {
    const { openApp } = require("./windows-apps");
    const r = await openApp(lastJob.app);
    return {
      reply: r.message,
      saved: lastJob.saved || [],
      ran: [],
      ok: r.ok,
    };
  }
  if (lastJob && lastJob.saved && lastJob.saved.length) {
    const ran = await runSaved(lastJob.saved, lastJob.files || []);
    return {
      reply: formatRunLines(lang, lastJob.saved, ran),
      saved: lastJob.saved,
      ran,
    };
  }
  return {
    reply:
      lang === "en"
        ? "Nothing queued. Tell me what to make or open."
        : "No hay nada en cola. Dime qué hago o qué abro.",
    saved: [],
    ran: [],
  };
}

module.exports = {
  nrm,
  peelDoIt,
  isWipe,
  isDestructive,
  looksLikeConfirm,
  looksLikeCancel,
  setLastJob,
  getLastJob,
  setPendingDanger,
  getPendingDanger,
  clearPendingDanger,
  consumeConfirm,
  writeAll,
  runFile,
  looksLongRunning,
  executeLast,
};
