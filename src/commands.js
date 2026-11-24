import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Enciende el servidor de Minecraft de Aternos')
    .setDMPermission(false)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Muestra el estado del servidor de Aternos')
    .setDMPermission(false)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Apaga el servidor de Minecraft de Aternos')
    .setDMPermission(false)
    .toJSON(),
];
