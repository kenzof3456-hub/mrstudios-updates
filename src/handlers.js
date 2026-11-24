import { EmbedBuilder } from 'discord.js';
import { messages, statusLabel } from './messages.js';

function hasAllowedRole(interaction, allowedRoleId) {
  if (!allowedRoleId) {
    return true;
  }
  return Boolean(interaction.member?.roles?.cache?.has(allowedRoleId));
}

function statusColor(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'online' || value === 'on') return 0x57f287;
  if (value === 'offline' || value === 'off') return 0xed4245;
  return 0xfee75c;
}

function field(name, value, inline = true) {
  const text = value && String(value).trim() ? String(value).trim() : '—';
  return { name, value: text, inline };
}

export function buildStatusEmbed(result) {
  const server = result.server || {};
  const info = result.info || {};
  const address = info.address
    ? `${info.address}${info.port ? `:${info.port}` : ''}`
    : null;

  return new EmbedBuilder()
    .setTitle(server.name || 'Servidor Aternos')
    .setColor(statusColor(server.status))
    .addFields(
      field('Estado', statusLabel(server.status)),
      field('Software', server.software || info.software),
      field('Jugadores', server.players || info.players),
      field('Dirección', address, false),
    );
}

export function buildActionEmbed(result) {
  const embed = buildStatusEmbed(result);
  const ok = result.success !== false;
  embed.setDescription(result.message || (ok ? 'Listo.' : 'La acción no se completó.'));
  return embed;
}

async function safeEdit(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
    return;
  }
  await interaction.reply(payload);
}

export async function handleChatInputCommand(interaction, { aternos, allowedRoleId } = {}) {
  if (typeof interaction.isChatInputCommand === 'function' && !interaction.isChatInputCommand()) {
    return false;
  }

  const commandName = interaction.commandName;
  if (!['start', 'status', 'stop'].includes(commandName)) {
    return false;
  }

  if (!hasAllowedRole(interaction, allowedRoleId)) {
    await interaction.reply({ content: messages.noPermission, ephemeral: true });
    return true;
  }

  await interaction.deferReply();

  try {
    if (!aternos?.[commandName]) {
      throw new Error('El cliente de Aternos no está configurado.');
    }

    const result = await aternos[commandName]();
    const embed = commandName === 'status' ? buildStatusEmbed(result) : buildActionEmbed(result);
    await safeEdit(interaction, { embeds: [embed] });
    return true;
  } catch (err) {
    await safeEdit(interaction, { content: messages.error(err) });
    return true;
  }
}
