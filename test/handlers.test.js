import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleChatInputCommand } from '../src/handlers.js';
import { messages } from '../src/messages.js';

function mockInteraction(commandName, { roleIds = [] } = {}) {
  const replies = [];
  const edits = [];
  return {
    replies,
    edits,
    commandName,
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    member: {
      roles: {
        cache: {
          has: (id) => roleIds.includes(id),
        },
      },
    },
    async reply(payload) {
      this.replied = true;
      replies.push(payload);
      return payload;
    },
    async deferReply() {
      this.deferred = true;
    },
    async editReply(payload) {
      edits.push(payload);
      return payload;
    },
  };
}

function mockAternos(overrides = {}) {
  return {
    async start() {
      return {
        action: 'start',
        success: true,
        server: { name: 'Survival', status: 'online', software: 'Paper', players: '0/20' },
        message: 'Servidor encendido.',
        info: { address: 'play.example.aternos.me', port: '25565' },
      };
    },
    async status() {
      return {
        action: 'status',
        success: true,
        server: { name: 'Survival', status: 'offline', software: 'Paper', players: '0/20' },
        info: { address: 'play.example.aternos.me', port: '25565' },
      };
    },
    async stop() {
      return {
        action: 'stop',
        success: true,
        server: { name: 'Survival', status: 'offline' },
        message: 'Servidor apagado.',
      };
    },
    ...overrides,
  };
}

test('/start replies with a success embed', async () => {
  const interaction = mockInteraction('start');
  await handleChatInputCommand(interaction, { aternos: mockAternos() });
  assert.equal(interaction.deferred, true);
  assert.equal(interaction.edits.length, 1);
  const embed = interaction.edits[0].embeds[0];
  assert.match(embed.data.description, /encendido/i);
  assert.equal(embed.data.title, 'Survival');
});

test('/status includes address and state', async () => {
  const interaction = mockInteraction('status');
  await handleChatInputCommand(interaction, { aternos: mockAternos() });
  const embed = interaction.edits[0].embeds[0];
  const fields = Object.fromEntries(embed.data.fields.map((field) => [field.name, field.value]));
  assert.equal(fields.Estado, 'Apagado');
  assert.match(fields.Dirección, /play\.example\.aternos\.me:25565/);
});

test('denied when the allowed role is missing', async () => {
  const interaction = mockInteraction('start', { roleIds: [] });
  let started = false;
  await handleChatInputCommand(interaction, {
    allowedRoleId: 'admins',
    aternos: mockAternos({
      async start() {
        started = true;
      },
    }),
  });
  assert.equal(started, false);
  assert.equal(interaction.replies[0].ephemeral, true);
  assert.equal(interaction.replies[0].content, messages.noPermission);
});

test('surfaces Aternos errors in the reply', async () => {
  const interaction = mockInteraction('start');
  await handleChatInputCommand(interaction, {
    aternos: mockAternos({
      async start() {
        throw new Error('Cloudflare blocked the login');
      },
    }),
  });
  assert.match(interaction.edits[0].content, /Cloudflare blocked the login/);
});
