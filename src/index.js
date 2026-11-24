import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config.js';
import { commands } from './commands.js';
import { createAternosController } from './aternos.js';
import { handleChatInputCommand } from './handlers.js';
import { ensureChromiumOnPath } from './chromium.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  console.error('Copia .env.example a .env y completa DISCORD_TOKEN y las credenciales de Aternos.');
  process.exit(1);
}

try {
  const chromium = ensureChromiumOnPath();
  console.log(`Chromium: ${chromium}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const aternosModule = await import('aternos-unofficial-api');
const AternosApi = aternosModule.loginToAternos ? aternosModule : aternosModule.default;
if (!AternosApi?.loginToAternos) {
  console.error('No se pudo cargar aternos-unofficial-api.');
  process.exit(1);
}

const aternos = createAternosController({
  api: AternosApi,
  username: config.aternosUsername,
  password: config.aternosPassword,
  serverId: config.aternosServerId,
  serverName: config.aternosServerName,
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Conectado como ${readyClient.user.tag}`);
  try {
    if (config.discordGuildId) {
      const guild = await readyClient.guilds.fetch(config.discordGuildId);
      await guild.commands.set(commands);
      console.log(`Comandos /start /status /stop registrados en ${guild.name}`);
    } else {
      await readyClient.application.commands.set(commands);
      console.log('Comandos /start /status /stop registrados de forma global');
    }
  } catch (err) {
    console.error('No se pudieron registrar los comandos slash:', err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleChatInputCommand(interaction, {
      aternos,
      allowedRoleId: config.allowedRoleId,
    });
  } catch (err) {
    console.error('Error al manejar la interacción:', err);
  }
});

client.on(Events.Error, (err) => {
  console.error('Error del cliente de Discord:', err);
});

await client.login(config.discordToken);
