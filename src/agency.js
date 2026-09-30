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
      timeout: 8000,
      env: { ...process.env, DISCORD_TOKEN: "" },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => resolve({ ok: false, detail: e.message }));
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        detail: (out || err || `exit ${code}`).trim().slice(0, 800),
        code,
      });
    });
  });
}

async function executeLast(craftDir, lang) {
  const files = getLastFiles();
  if (files.length && craftDir) {
    const saved = writeAll(craftDir, files);
    setLastJob({ type: "craft", saved });
    return {
      reply:
        lang === "en"
          ? "Done. Wrote:\n" + saved.join("\n")
          : "Hecho. Escrito:\n" + saved.join("\n"),
      saved,
    };
  }
  if (lastJob && lastJob.saved && lastJob.saved.length) {
    return {
      reply:
        lang === "en"
          ? "Already on disk:\n" + lastJob.saved.join("\n")
          : "Ya está en disco:\n" + lastJob.saved.join("\n"),
      saved: lastJob.saved,
    };
  }
  return {
    reply:
      lang === "en"
        ? "Nothing queued. Tell me what to make or open."
        : "No hay nada en cola. Dime qué hago o qué abro.",
    saved: [],
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
  executeLast,
};
