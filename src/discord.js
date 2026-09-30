const { isWindows, launchDiscord, isProcessRunning, runPowershell } = require("./windows-apps");

const CAMERA_KEYBIND = "Ctrl+Shift+V";

async function enableDiscordCamera() {
  if (!isWindows) {
    return {
      ok: false,
      did: "none",
      message:
        "¡Ojo, Rabbit! El control de la cámara de Discord solo corre en tu PC Windows. " +
        "Allí abro Discord y mando el atajo de alternar cámara. Aquí no puedo tocarla, pero ya quedó anotado el plan.",
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
      message:
        (already ? "Discord ya estaba abierto, qué suerte. " : "¡Abrí Discord! ") +
        `Enfoqué la ventana y envié ${CAMERA_KEYBIND} (Toggle Camera). ` +
        "Discord no deja forzar ni leer la webcam, así que esto es lo más cercano que funciona. " +
        `Si no se encendió, Rabbit, en Ajustes → Atajos asigna «Activar cámara» a ${CAMERA_KEYBIND} y me avisas.`,
    };
  }

  return {
    ok: Boolean(launch.ok || already),
    did: already || launch.ok ? "opened_discord_only" : "failed",
    message:
      (already || launch.ok
        ? "Encontré Discord, pero no pude enviar el atajo de cámara (la ventana a veces tarda). "
        : "No pude abrir Discord esta vez. ") +
      `Atajo: ${CAMERA_KEYBIND}. No hay forma fiable de forzar la cámara. ` +
      "Asigna ese atajo en Discord y lo volvemos a intentar, Rabbit.",
  };
}

module.exports = { enableDiscordCamera, CAMERA_KEYBIND };
