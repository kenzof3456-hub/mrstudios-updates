function setEar(text) {
  const el = document.getElementById("ear");
  if (el) el.textContent = text;
}

function SpeechEngine() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function createListener({ onFinal, onError }) {
  const Engine = SpeechEngine();
  if (!Engine) {
    return { supported: false };
  }

  let rec = null;
  let want = false;
  let ptt = false;

  function attach(instance) {
    instance.lang = "es-MX";
    instance.continuous = !ptt;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      final = final.trim();
      if (final) onFinal(final);
    };
    instance.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") onError(e.error);
    };
    instance.onend = () => {
      if (want && !ptt) {
        try {
          instance.start();
        } catch {
          /* already started */
        }
      }
    };
  }

  function startAlways() {
    want = true;
    ptt = false;
    if (!rec) {
      rec = new Engine();
      attach(rec);
    }
    rec.continuous = true;
    try {
      rec.start();
      setEar("OÍDO: SIEMPRE ON");
    } catch {
      setEar("OÍDO: YA ACTIVO");
    }
  }

  function stop() {
    want = false;
    ptt = false;
    try {
      rec && rec.stop();
    } catch {
      /* ignore */
    }
    setEar("OÍDO: OFF");
  }

  function startPtt() {
    want = true;
    ptt = true;
    rec = new Engine();
    attach(rec);
    rec.continuous = false;
    try {
      rec.start();
      setEar("OÍDO: PTT");
    } catch (err) {
      onError(String(err.message || err));
    }
  }

  function endPtt() {
    try {
      rec && rec.stop();
    } catch {
      /* ignore */
    }
    want = false;
    ptt = false;
    setEar("OÍDO: OFF");
  }

  return { supported: true, startAlways, stop, startPtt, endPtt };
}

window.createListener = createListener;
window.speechSupported = () => Boolean(SpeechEngine());
