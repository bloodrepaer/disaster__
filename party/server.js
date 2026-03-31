/**
 * DisasterNet — Partykit server
 * Handles the real-time cross-device mesh relay.
 *
 * Deploy:
 *   npx partykit deploy --name disasternet
 *
 * Then set PARTYKIT_HOST = "disasternet.YOUR_USERNAME.partykit.dev"
 * in Vercel environment variables so index.html picks it up at runtime.
 *
 * Each "room" = one DisasterNet ops session (default: "disasternet-india-ops").
 * All connected clients in the same room receive each other's messages.
 *
 * Message types relayed:
 *   ping / pong         — node presence heartbeat
 *   missing_person      — new person logged by rescue worker
 *   rescued_person      — person moved to rescued status
 *   agent_msg           — AI triage decision from command station
 *   field_report        — field operator text report
 *   road_status         — road marked clear / risky / blocked
 *   drone_required      — zone flagged for drone dispatch
 *   world_id_verified   — volunteer World ID proof anchored
 *   sos_cancelled       — victim SOS cancelled
 */

/** @type {import("partykit/server").PartyKitServer} */
export default {
  /**
   * onConnect — called when a new WebSocket client joins the room.
   * Announces the new node to all existing connections.
   */
  onConnect(conn, room) {
    // Notify all existing peers that a new node joined
    room.broadcast(
      JSON.stringify({
        type: 'node_joined',
        nodeId: conn.id,
        ts: new Date().toISOString(),
        from: 'server',
      }),
      [conn.id] // exclude the joining connection itself
    );

    // Send the new connection a welcome with current peer count
    conn.send(
      JSON.stringify({
        type: 'welcome',
        yourId: conn.id,
        peers: room.connections.size,
        room: room.id,
        ts: new Date().toISOString(),
      })
    );
  },

  /**
   * onMessage — relay every message to all other connections in the room.
   * No server-side storage — pure relay. The Vercel KV backend handles persistence.
   */
  onMessage(message, sender, room) {
    let parsed;
    try {
      parsed = typeof message === 'string' ? JSON.parse(message) : message;
    } catch {
      return; // ignore malformed messages
    }

    // Rate-limit guard: drop messages larger than 32KB
    const raw = typeof message === 'string' ? message : JSON.stringify(message);
    if (raw.length > 32768) return;

    // Stamp with server receive time and relay to everyone except sender
    const relayed = JSON.stringify({ ...parsed, _serverTs: Date.now() });
    room.broadcast(relayed, [sender.id]);
  },

  /**
   * onClose — notify remaining peers that a node left.
   */
  onClose(conn, room) {
    room.broadcast(
      JSON.stringify({
        type: 'node_left',
        nodeId: conn.id,
        ts: new Date().toISOString(),
        from: 'server',
      })
    );
  },

  /**
   * onError — log only, don't crash the room.
   */
  onError(conn, err) {
    console.error(`[DisasterNet Partykit] connection error for ${conn.id}:`, err);
  },
};
