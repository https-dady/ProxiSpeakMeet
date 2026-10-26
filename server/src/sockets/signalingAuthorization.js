/**
 * Authorization helpers for WebRTC signaling.
 *
 * A signaling message is authorized only when:
 * - Both participants have active presence records.
 * - Both participants belong to the sender's authoritative room.
 * - A PeerGraph edge exists between the participants.
 * - The edge belongs to that same room.
 *
 * This prevents cross-room signaling and signaling over stale or
 * mismatched peer connections.
 */

export function getAuthorizedPeerSignalEdge({
  senderId,
  recipientId,
  roomId,
  store,
  peerGraph,
}) {
  if (
    typeof senderId !== 'string' ||
    !senderId ||
    typeof recipientId !== 'string' ||
    !recipientId ||
    typeof roomId !== 'string' ||
    !roomId ||
    !store ||
    !peerGraph
  ) {
    return null;
  }

  // Both participants must have active presence records.
  const sender = store.get(senderId);
  const recipient = store.get(recipientId);

  if (
    !sender ||
    sender.id !== senderId ||
    sender.roomId !== roomId ||
    !recipient ||
    recipient.id !== recipientId ||
    recipient.roomId !== roomId
  ) {
    return null;
  }

  // A valid presence record alone is insufficient.
  // The current peer connection must also belong to this room.
  const edge = peerGraph.edge(senderId, recipientId);

  if (!edge || edge.roomId !== roomId) {
    return null;
  }

  return edge;
}

export default getAuthorizedPeerSignalEdge;