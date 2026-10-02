const { isWindows, runPowershell, launchDiscord } = require("./windows-apps");

function psStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

async function startUri(uri) {
  return runPowershell(`Start-Process ${psStr(uri)}`);
}

async function focusProcess(name) {
  return runPowershell(`
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms
$p = Get-Process | Where-Object { $_.ProcessName -match ${psStr(name)} -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { throw 'no-window' }
[Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) | Out-Null
Start-Sleep -Milliseconds 500
Write-Output 'ok'
`);
}

async function clipboardSend(searchChord, contact, body, enterAfterSearch = true) {
  const search = searchChord || "^k";
  const enter = enterAfterSearch ? "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 500;" : "";
  return runPowershell(`
Add-Type -AssemblyName System.Windows.Forms
Set-Clipboard -Value ${psStr(contact)}
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait(${psStr(search)})
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 350
${enter}
Set-Clipboard -Value ${psStr(body)}
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Write-Output 'typed'
`);
}

function isPhone(s) {
  return /^\+?\d[\d\s-]{7,}$/.test(String(s).trim());
}

function isEmail(s) {
  return /@/.test(String(s));
}

async function sendOnWindows(app, to, body) {
  if (!isWindows) {
    return {
      ok: false,
      did: "not-windows",
      detail: "La automatización de envío corre en tu PC Windows.",
    };
  }

  const text = String(body || "");
  const who = String(to || "");

  try {
    if (app === "email") {
      if (!isEmail(who)) {
        return {
          ok: false,
          did: "need-address",
          detail: `No invento correos. Dime el email de ${who} o recuérdamelo.`,
        };
      }
      const uri = `mailto:${encodeURIComponent(who)}?body=${encodeURIComponent(text)}`;
      const r = await startUri(uri);
      return {
        ok: r.ok,
        did: r.ok ? "mailto" : "fail",
        detail: r.ok
          ? "Abrí el correo con el texto pegado. Dale a enviar si el cliente lo pide."
          : r.stderr,
      };
    }

    if (app === "sms") {
      if (!isPhone(who)) {
        return {
          ok: false,
          did: "need-phone",
          detail: `No invento números. Dime el teléfono de ${who} o recuérdamelo.`,
        };
      }
      const num = who.replace(/[^\d+]/g, "");
      const uri = `sms:${num}?body=${encodeURIComponent(text)}`;
      const r = await startUri(uri);
      return {
        ok: r.ok,
        did: r.ok ? "sms-uri" : "fail",
        detail: r.ok ? "Abrí SMS con el texto. Confirma el envío en la app." : r.stderr,
      };
    }

    if (app === "whatsapp") {
      let uri = "whatsapp://send?text=" + encodeURIComponent(text);
      if (isPhone(who)) {
        uri = `https://wa.me/${who.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
      }
      await startUri(uri);
      await new Promise((r) => setTimeout(r, 2200));
      const focused = await focusProcess("WhatsApp");
      if (!focused.ok) {
        return {
          ok: true,
          did: "opened-uri",
          detail:
            "Abrí WhatsApp con el texto. Si el contacto no se abrió solo, elígelo tú: no invento chats.",
        };
      }
      if (!isPhone(who)) {
        const typed = await clipboardSend("^f", who, text);
        return {
          ok: typed.ok,
          did: typed.ok ? "whatsapp-ui" : "opened-uri",
          detail: typed.ok
            ? `Busqué «${who}» en WhatsApp, pegué el texto y mandé Enter.`
            : "WhatsApp está abierto; no pude teclear el contacto. Mándalo tú en el chat.",
        };
      }
      return {
        ok: true,
        did: "wa-me",
        detail: "Abrí el chat de WhatsApp (wa.me) con el mensaje. Confirma Enviar si pide clic.",
      };
    }

    if (app === "discord") {
      await startUri("discord://");
      await launchDiscord();
      await new Promise((r) => setTimeout(r, 2500));
      const focused = await focusProcess("Discord");
      if (!focused.ok) {
        return {
          ok: false,
          did: "no-window",
          detail: "Abrí Discord pero no vi ventana. Ábrelo y lo reintento.",
        };
      }
      const typed = await clipboardSend("^k", who, text);
      return {
        ok: typed.ok,
        did: typed.ok ? "discord-ui" : "opened",
        detail: typed.ok
          ? `Quick Switcher (Ctrl+K) → «${who}», pegué el texto y Enter.`
          : "Discord está al frente; no pude completar el envío automático.",
      };
    }

    if (app === "telegram") {
      await startUri("tg://");
      await new Promise((r) => setTimeout(r, 2000));
      const focused = await focusProcess("Telegram");
      if (!focused.ok) {
        return {
          ok: true,
          did: "opened-uri",
          detail: "Lancé Telegram. Elige el chat: no invento contactos.",
        };
      }
      const typed = await clipboardSend("^f", who, text);
      return {
        ok: typed.ok,
        did: typed.ok ? "telegram-ui" : "opened",
        detail: typed.ok
          ? `Busqué «${who}» en Telegram, pegué y Enter.`
          : "Telegram abierto; completa el envío si el buscador no saltó.",
      };
    }

    return { ok: false, did: "unknown-app", detail: `No sé enviar por ${app}.` };
  } catch (err) {
    return { ok: false, did: "error", detail: String(err.message || err) };
  }
}

module.exports = { sendOnWindows };
