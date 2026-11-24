export const messages = {
  thinkingStart: '⏳ Encendiendo el servidor de Aternos… esto puede tardar un par de minutos.',
  thinkingStatus: '⏳ Consultando el estado del servidor…',
  thinkingStop: '⏳ Apagando el servidor de Aternos…',
  noPermission: 'No tienes permiso para usar este comando.',
  unknownCommand: 'Comando no reconocido.',
  alreadyOnline: 'El servidor ya está en línea.',
  alreadyOffline: 'El servidor ya está apagado.',
  started: 'Servidor encendido.',
  startRequested: 'Se pidió encender el servidor.',
  stopped: 'Servidor apagado.',
  stopRequested: 'Se pidió apagar el servidor.',
  error(err) {
    const text = sanitizeClientMessage(err?.message || String(err));
    return `❌ No se pudo completar la acción: ${text || 'error desconocido.'}`;
  },
};

export function sanitizeClientMessage(message) {
  if (!message) return '';
  return String(message)
    .replace(/Retry Rerun the console i think delay it/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function statusLabel(status) {
  const value = String(status || 'unknown').toLowerCase();
  if (value === 'online' || value === 'on') return 'En línea';
  if (value === 'offline' || value === 'off') return 'Apagado';
  if (value.includes('load') || value.includes('queue') || value.includes('start')) {
    return 'Encendiendo';
  }
  return status || 'Desconocido';
}
