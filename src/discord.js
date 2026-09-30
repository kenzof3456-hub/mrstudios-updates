const { isWindows, launchDiscord, isProcessRunning, runPowershell } = require("./windows-apps");

const CAMERA_KEYBIND = "Ctrl+Shift+V";

async function enableDiscordCamera() {
  if (!isWindows) {
    return {
      ok: false,
      did: "none",
      message:
        "Rabbit, el control de la cámara de Discord solo corre en tu PC Windows. " +
        "Ahí abro Discord y envío el atajo de alternar cámara.",
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
        (already ? "Discord ya estaba abierto. " : "Abrí Discord. ") +
        `Enfoqué la ventana y envié ${CAMERA_KEYBIND} (Toggle Camera). ` +
        "Discord no expone una API para forzar la webcam ni leer si quedó encendida. " +
        `Si no se activó, Rabbit, ve a Ajustes de Discord → Atajos de teclado y asigna «Activar cámara» a ${CAMERA_KEYBIND}.`,
    };
  }

  return {
    ok: Boolean(launch.ok || already),
    did: already || launch.ok ? "opened_discord_only" : "failed",
    message:
      (already || launch.ok
        ? "Abrí o encontré Discord, pero no pude enviar el atajo de cámara (la ventana puede no estar lista). "
        : "No pude abrir Discord. ") +
      `Atajo usado: ${CAMERA_KEYBIND}. Discord no permite forzar la cámara de forma fiable. ` +
      "Si quieres, asigna ese atajo en Discord y vuelve a pedírmelo.",
  };
}

module.exports = { enableDiscordCamera, CAMERA_KEYBIND };
