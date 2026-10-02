const { execFile } = require("child_process");

function ocrFile(filePath) {
  return new Promise((resolve) => {
    execFile(
      "tesseract",
      [filePath, "stdout", "-l", "spa+eng"],
      { timeout: 20000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve("");
          return;
        }
        resolve(String(stdout).replace(/\s+/g, " ").trim().slice(0, 1200));
      }
    );
  });
}

module.exports = { ocrFile };
