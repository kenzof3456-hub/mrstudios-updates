# Jarvis

Asistente de escritorio **nativo para Windows** (Electron). No es un sitio web.

Jarvis habla con **Rabbit** (Luis) en español, HUD oscuro estilo J.A.R.V.I.S.

## Qué hace (v1)

1. Chat de texto.
2. Abre y cierra apps de Windows por nombre (menú Inicio, rutas conocidas, `taskkill`). Confirma en el chat.
3. Perfil local persistente: Luis / Rabbit / Windows.
4. **Memoria local** (`userData/memory.json`): si Rabbit cuenta hechos (gustos, apps, Discord, horarios, cómo le gusta que le hablen), Jarvis los guarda y los usa después. «qué sabes de mí» los lista; «olvida X» o «olvida todo» los borra.
5. Cámara de Discord (mejor esfuerzo): abre Discord si hace falta, enfoca la ventana y envía **Ctrl+Shift+V** (Toggle Camera).
6. Preguntas generales: busca en la web y responde en español, con fuentes cortas.
7. Hora, día de la semana y fecha en español, zona horaria local de Windows.

Tono: alegre, cálido, un poco ingenioso; siempre te llama **Rabbit**. Español por defecto.

La voz queda para después.

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

Sin `OPENAI_API_KEY` Jarvis sigue resolviendo hora, perfil, abrir/cerrar apps, Discord y búsqueda web.

## Cómo generar el instalador

```powershell
npm install
npm run dist:win
```

El setup queda en `dist/Jarvis-Setup-1.0.0.exe`.

## Variables de entorno

Ver `.env.example`:

- `OPENAI_API_KEY` — opcional, API compatible con OpenAI
- `OPENAI_BASE_URL` — por defecto `https://api.openai.com/v1`
- `OPENAI_MODEL` — por defecto `gpt-4o-mini`

## Tests locales (también en Linux CI)

```bash
npm test
```
