const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const isWindows = process.platform === "win32";

const KNOWN_APPS = [
  {
    aliases: ["notepad", "bloc de notas", "block de notas", "notepad.exe"],
    exe: "notepad.exe",
    image: "notepad.exe",
  },
  {
    aliases: ["calculadora", "calculator", "calc"],
    exe: "calc.exe",
    image: "CalculatorApp.exe",
    extraImages: ["win32calc.exe", "calc.exe"],
  },
  {
    aliases: ["explorador", "explorer", "archivos"],
    exe: "explorer.exe",
    image: "explorer.exe",
  },
  {
    aliases: ["cmd", "terminal", "simbolo del sistema", "command prompt"],
    exe: "cmd.exe",
    image: "cmd.exe",
  },
  {
    aliases: ["powershell"],
    exe: "powershell.exe",
    image: "powershell.exe",
  },
  {
    aliases: ["paint", "mspaint"],
    exe: "mspaint.exe",
    image: "mspaint.exe",
  },
  {
    aliases: ["discord"],
    exe: null,
    image: "Discord.exe",
    launcher: "discord",
  },
  {
    aliases: ["chrome", "google chrome"],
    exe: "chrome.exe",
    image: "chrome.exe",
  },
  {
    aliases: ["edge", "microsoft edge"],
    exe: "msedge.exe",
    image: "msedge.exe",
  },
  {
    aliases: ["spotify"],
    exe: "spotify.exe",
    image: "Spotify.exe",
  },
  {
    aliases: ["vs code", "vscode", "code", "visual studio code"],
    exe: "code",
    image: "Code.exe",
  },
];

function runPowershell(script) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: String(stdout || "").trim(),
          stderr: String(stderr || (err && err.message) || "").trim(),
        });
      }
    );
  });
}

function matchKnown(appName) {
  const n = String(appName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return KNOWN_APPS.find((a) => a.aliases.some((al) => n.includes(al) || al.includes(n)));
}

function discordUpdateExe() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "Discord", "Update.exe");
}

async function launchDiscord() {
  const updater = discordUpdateExe();
  if (fs.existsSync(updater)) {
    const r = await runPowershell(
      `Start-Process -FilePath '${updater.replace(/'/g, "''")}' -ArgumentList '--processStart','Discord.exe'`
    );
    return r;
  }
  return runPowershell("Start-Process 'discord:'");
}

async function openApp(appName) {
  if (!isWindows) {
    return {
      ok: false,
      message: `Rabbit, abrir apps es magia de tu PC Windows. Pediste abrir: ${appName}. En cuanto estemos ahí, lo lanzo.`,
    };
  }

  const known = matchKnown(appName);
  if (known?.launcher === "discord") {
    const r = await launchDiscord();
    return {
      ok: r.ok,
      message: r.ok
        ? "¡Dale, Rabbit! Estoy abriendo Discord."
        : `Uy, no pude lanzar Discord (${r.stderr || "error"}). Lo reintentamos cuando quieras.`,
    };
  }

  if (known?.exe) {
    const r = await runPowershell(
      `Start-Process -FilePath '${known.exe.replace(/'/g, "''")}'`
    );
    if (r.ok) {
      return { ok: true, message: `¡Hecho, Rabbit! Abrí ${appName}.` };
    }
  }

  const escaped = String(appName).replace(/'/g, "''");
  const script = `
$ErrorActionPreference = 'Stop'
$needle = '${escaped}'
$app = Get-StartApps | Where-Object { $_.Name -like "*$needle*" } | Select-Object -First 1
if (-not $app) { throw "No encontré '$needle' en el menú Inicio." }
Start-Process "explorer.exe" "shell:AppsFolder\\$($app.AppID)"
Write-Output $app.Name
`;
  const r = await runPowershell(script);
  if (r.ok) {
    const name = r.stdout || appName;
    return { ok: true, message: `¡Hecho, Rabbit! Abrí ${name}.` };
  }
  return {
    ok: false,
    message: `No pude abrir «${appName}», Rabbit. ${r.stderr || r.stdout || "No está en Inicio ni en rutas conocidas."} Si me dices el nombre exacto, lo vuelvo a intentar.`,
  };
}

async function closeApp(appName) {
  if (!isWindows) {
    return {
      ok: false,
      message: `Cerrar apps también es cosa de tu Windows, Rabbit. Pediste cerrar: ${appName}.`,
    };
  }

  const known = matchKnown(appName);
  const images = [];
  if (known?.image) images.push(known.image);
  if (known?.extraImages) images.push(...known.extraImages);
  const raw = String(appName).replace(/\.exe$/i, "");
  images.push(`${raw}.exe`);

  const unique = [...new Set(images)];
  for (const image of unique) {
    const r = await runPowershell(
      `Stop-Process -Name '${image.replace(/\.exe$/i, "").replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue; taskkill /IM '${image.replace(/'/g, "''")}' /F 2>$null; Write-Output 'ok'`
    );
    if (r.ok) {
      return { ok: true, message: `Listo, Rabbit. Cerré ${appName}. Un clic y se fue.` };
    }
  }

  return {
    ok: false,
    message: `No pude cerrar «${appName}», Rabbit. Puede que no estuviera en ejecución. Si sigue ahí, dime y lo intentamos otra vez.`,
  };
}

async function isProcessRunning(name) {
  if (!isWindows) return false;
  const r = await runPowershell(
    `if (Get-Process -Name '${name.replace(/'/g, "''")}' -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`
  );
  return r.stdout.toLowerCase().includes("yes");
}

module.exports = {
  isWindows,
  openApp,
  closeApp,
  launchDiscord,
  isProcessRunning,
  runPowershell,
};
