const fs = require("fs");
const path = require("path");

const MAX_BYTES = 12 * 1024 * 1024;

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"]);
const TEXT_EXT = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
  ".html",
  ".xml",
  ".css",
]);

function extOf(filePath) {
  return path.extname(filePath || "").toLowerCase();
}

function kindOf(filePath) {
  const ext = extOf(filePath);
  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (TEXT_EXT.has(ext)) return "text";
  return "file";
}

function mimeOf(filePath) {
  const ext = extOf(filePath);
  return (
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".json": "application/json",
      ".html": "text/html",
    }[ext] || "application/octet-stream"
  );
}

function safeName(name) {
  return String(name || "archivo")
    .replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, "_")
    .slice(0, 80);
}

function readTextSnippet(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.includes(0)) return "";
  return buf.toString("utf8").replace(/\u0000/g, "").trim().slice(0, 8000);
}

function copyIntoUploads(dir, srcPath) {
  if (!srcPath || !fs.existsSync(srcPath)) {
    throw new Error("no-file");
  }
  const stat = fs.statSync(srcPath);
  if (!stat.isFile()) throw new Error("not-file");
  if (stat.size > MAX_BYTES) throw new Error("too-large");
  const uploads = path.join(dir, "uploads");
  fs.mkdirSync(uploads, { recursive: true });
  const base = safeName(path.basename(srcPath));
  const dest = path.join(uploads, `${Date.now().toString(36)}_${base}`);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

function fileToDataUrl(filePath) {
  const mime = mimeOf(filePath);
  const b64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${b64}`;
}

module.exports = {
  MAX_BYTES,
  kindOf,
  mimeOf,
  safeName,
  readTextSnippet,
  copyIntoUploads,
  fileToDataUrl,
};
