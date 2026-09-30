const { isWindows, launchDiscord, isProcessRunning, runPowershell } = require("./windows-apps");
const { say } = require("./voice");

const CAMERA_KEYBIND = "Ctrl+Shift+V";

async function enableDiscordCamera() {
  if (!isWindows) {
    return {
      ok: false,
      did: "none",
      message: say(
        "¡Ojo, Rabbit!",
        "La cámara de Discord la controlo en tu Windows, no aquí.",
        "Allí abro Discord y mando Ctrl+Shift+V. Promesa."
      ),
    };
  }

  const already = await isProcessRunning("Discord");
  const launch = already
    ? { ok: true }
    : await launchDiscord();

  if (!already) {
    await new Promise((r) => setTimeout(r, 4500));
  }

  const sendKeys = await runPowershell(`
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms
$p = Get-Process | Where-Object { $_.ProcessName -match 'Discord' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { throw 'Discord no tiene ventana visible todavía.' }
[Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) | Out-Null
Start-Sleep -Milliseconds 600
[System.Windows.Forms.SendKeys]::SendWait('^+v')
Write-Output 'sent'
`);

  if (sendKeys.ok) {
    return {
      ok: true,
      did: "launch_focus_toggle_camera",
      message: say(
        already ? "¡Discord ya estaba despierto!" : "¡Abrí Discord!",
        `Enfoqué la ventana y mandé ${CAMERA_KEYBIND} (cámara).`,
        "Ojo: Discord no deja forzar ni leer la webcam. Esto es lo más cerca que llega.",
        `Si no se encendió, asigna «Activar cámara» a ${CAMERA_KEYBIND} y me avisas, Rabbit.`
      ),
    };
  }

  return {
    ok: Boolean(launch.ok || already),
    did: already || launch.ok ? "opened_discord_only" : "failed",
    message: say(
      already || launch.ok ? "Casi… encontré Discord." : "Ay. Discord no quiso abrir.",
      already || launch.ok
        ? "No pude mandar el atajo. A veces la ventana tarda."
        : "Sin ventana, no hay cámara.",
      `Atajo: ${CAMERA_KEYBIND}. No hay forma fiable de forzar la cam.`,
      "Lo intentamos otra vez cuando quieras, Rabbit."
    ),
  };
}

module.exports = { enableDiscordCamera, CAMERA_KEYBIND };
