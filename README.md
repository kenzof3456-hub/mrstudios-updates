# Jarvis

Asistente de escritorio **nativo para Windows** (Electron). No es un sitio web.

Jarvis habla con **Rabbit** (Luis) en español, HUD oscuro estilo J.A.R.V.I.S.

## Qué hace (v1)

1. Chat de texto **y por voz**.
2. Abre y cierra apps de Windows por nombre (menú Inicio, rutas conocidas, `taskkill`). Confirma en el chat.
3. Perfil local persistente: Luis / Rabbit / Windows.
4. **Memoria local** (`userData/memory.json`): si Rabbit cuenta hechos (gustos, apps, Discord, horarios, cómo le gusta que le hablen), Jarvis los guarda y los usa después. «qué sabes de mí» los lista; «olvida X» o «olvida todo» los borra.
5. Cámara de Discord (mejor esfuerzo): abre Discord si hace falta, enfoca la ventana y envía **Ctrl+Shift+V** (Toggle Camera).
6. Preguntas generales: busca en la web y responde en español, con fuentes cortas.
7. Hora, día de la semana y fecha en español, zona horaria local de Windows.
8. **Voz:** oído siempre (o PTT). Palabra de activación **«Jarvis»** → responde en voz alta al momento (saludo o chiste). Luego ejecuta la orden hablada. TTS expresivo: OpenAI si hay clave, si no **voces de Chromium / SAPI de Windows**.
9. **Pantalla (solo si lo pides):** «mira mi pantalla» captura el monitor principal y la guarda en `userData/last-screen.png`. Nunca en segundo plano. «qué es esto» / «quién es»: visión (si hay API) u OCR local (`tesseract`), luego búsqueda web. La imagen solo se envía al LLM que configuraste.
10. **Mensajes a una persona:** «manda a mamá por WhatsApp que ya voy». Parsea destinatario, texto y app (WhatsApp, Discord, Telegram, SMS, correo). Si no dices app, usa un recuerdo tipo «usa WhatsApp para mamá» o pregunta **una vez** y lo guarda. En Windows abre/enfoca la app (URI `whatsapp://`, `wa.me`, `discord`, `tg://`, `mailto:`, `sms:`), busca el contacto, pega y Enter. Confirma en voz qué se mandó o qué lo bloqueó. Sin destinatario + mensaje claros, no envía. Apodos desde `memory.json`; no inventa números ni correos.

Tono: alegre y **expresivo**. UI: esfera azul central (pulso en reposo, anillos al escuchar, ondas al hablar). Chat secundario.

## Micrófono (Windows)

1. Configuración de Windows → Privacidad y seguridad → Micrófono → **Permitir que las aplicaciones de escritorio accedan al micrófono**.
2. Al pulsar **Oído siempre** o **PTT**, Electron pide el mic. Acepta.
3. STT v1: **Web Speech API** de Chromium (`es-MX`). En algunas builds necesita red. Alternativa PTT si el oído continuo se corta.
4. Di **«Jarvis»** (o «oye Jarvis…»). Contesta en voz alta. Sigue con la orden: «Jarvis, qué hora es».
5. TTS: con `OPENAI_API_KEY` usa `/audio/speech` (voz `nova`). Sin clave: `speechSynthesis` (voces en español del sistema) y, en Windows, **System.Speech** (SAPI).

Oído continuo puede oír al propio TTS; Jarvis pausa el reconocimiento mientras habla.

## Pantalla (solo bajo orden)

Nunca captura en segundo plano. Di **«Jarvis, mira mi pantalla»**. Luego **«qué es esto»** o **«quién es»**. Windows puede pedir permiso de captura. `OPENAI_API_KEY` activa visión; si no, intenta `tesseract` local.

## Límite de la cámara de Discord

Discord **no tiene API pública** para encender la webcam ni para leer si quedó activa. Jarvis hace lo más cercano que funciona: lanzar Discord + atajo de teclado. En Ajustes de Discord → Atajos de teclado, asigna **Activar cámara** a `Ctrl+Shift+V`. Si no está asignado, Jarvis te lo dice claro en el chat.

## Requisitos (PC de Rabbit)

- Windows 10/11
- [Node.js 20+](https://nodejs.org/) (incluye npm)

## Cómo correr (desarrollo)

En PowerShell:

```powershell
cd ruta\a\mrstudios-updates
copy .env.example .env
# opcional: pega OPENAI_API_KEY para que las respuestas generales las redacte un LLM
npm install
npm start
```

Sin `OPENAI_API_KEY` Jarvis sigue con hora, perfil, apps, Discord, búsqueda, memoria y **TTS local**.

## Cómo generar el instalador

```powershell
npm install
npm run dist:win
```

El setup queda en `dist/Jarvis-Setup-1.0.0.exe`.

## Variables de entorno

Ver `.env.example`:

- `OPENAI_API_KEY` — opcional, chat LLM + TTS cloud
- `OPENAI_BASE_URL` — por defecto `https://api.openai.com/v1`
- `OPENAI_MODEL` — por defecto `gpt-4o-mini`
- `OPENAI_TTS_MODEL` — por defecto `tts-1`
- `OPENAI_TTS_VOICE` — por defecto `nova`

## Tests locales (también en Linux CI)

```bash
npm test
```
