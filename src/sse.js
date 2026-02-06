// Per-user SSE broadcasting
const userClients = new Map(); // userId -> Set<res>

export function addClient(userId, res) {
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  userClients.get(userId).add(res);
}

export function removeClient(userId, res) {
  const clients = userClients.get(userId);
  if (!clients) return;
  clients.delete(res);
  if (clients.size === 0) userClients.delete(userId);
}

export function broadcastToUser(userId, event, data) {
  const clients = userClients.get(userId);
  if (!clients) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  }
  if (clients.size === 0) userClients.delete(userId);
}
