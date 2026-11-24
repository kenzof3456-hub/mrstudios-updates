# mrstudios-updates

Instaladores de MRstudios Launcher (imágenes en `covers/`) y bot de Discord para encender el servidor de Minecraft de Aternos.

## Bot de Discord (Aternos)

El bot registra los comandos slash **`/start`**, **`/status`** y **`/stop`**. `/start` inicia el servidor de Aternos asociado a la cuenta configurada.

### Aviso: no hay API oficial (ToS)

Aternos **no publica una API oficial** para encender servidores. Este proyecto usa el cliente no oficial [`aternos-unofficial-api`](https://www.npmjs.com/package/aternos-unofficial-api) (Puppeteer sobre el panel web).

Esa automatización **puede violar los [términos de servicio de Aternos](https://aternos.gmbh/en/aternos/terms)** y provocar el bloqueo de la cuenta. Úsalo bajo tu propio riesgo, solo con **tu** servidor, y no como bot AFK ni para saltarse anuncios. Si necesitas un control oficial, [exaroton](https://exaroton.com/) (del mismo equipo) sí tiene API y bot oficiales.

### Requisitos

- Node.js 20 o superior
- Chromium en el `PATH` como `chromium` (el cliente no oficial lo lanza con Puppeteer)
- Una aplicación/bot de Discord
- Una cuenta de Aternos con al menos un servidor

En Debian/Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y chromium
```

Si el binario se llama `chromium-browser` o `google-chrome`, el bot lo detecta y lo expone como `chromium` (o define `CHROMIUM_PATH`).

### Crear el bot en Discord

1. Abre el [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. En **Bot**, crea el bot y copia el token (`DISCORD_TOKEN`).
3. En **OAuth2 → URL Generator**, marca los scopes `bot` y `applications.commands`.
4. Permisos mínimos: **Send Messages**, **Use Slash Commands**, **Embed Links**.
5. Abre la URL generada e invita el bot a tu servidor.

### Configuración

```bash
npm install
cp .env.example .env
```

Edita `.env`:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DISCORD_TOKEN` | sí | Token del bot |
| `ATERNOS_USERNAME` | sí | Usuario de Aternos (`ATERNOS_USER` también vale) |
| `ATERNOS_PASSWORD` | sí | Contraseña de Aternos (`ATERNOS_PASS` también vale) |
| `DISCORD_GUILD_ID` | no | ID del servidor de Discord. Si se define, los slash commands aparecen al instante. Si no, se registran de forma global (puede tardar unos minutos). |
| `DISCORD_ALLOWED_ROLE_ID` | no | Si se define, solo ese rol puede usar `/start` y `/stop` (y `/status`). |
| `ATERNOS_SERVER_ID` | no | ID del servidor Aternos si la cuenta tiene más de uno |
| `ATERNOS_SERVER_NAME` | no | Nombre del servidor Aternos si la cuenta tiene más de uno |
| `CHROMIUM_PATH` | no | Ruta al binario de Chromium/Chrome si no está en el PATH |

No subas `.env` ni `aternos-cookies.json` (el cliente no oficial guarda la sesión ahí).

### Arranque

```bash
npm start
```

Cuando el bot esté en línea, en Discord usa:

- `/start` — enciende el servidor (espera a que Aternos lo deje en marcha, hasta ~3 minutos)
- `/status` — nombre, estado, software, jugadores y dirección
- `/stop` — apaga el servidor

### Desarrollo

```bash
npm test
```

Las pruebas no necesitan token ni cuenta de Aternos: el cliente se sustituye por un mock.
