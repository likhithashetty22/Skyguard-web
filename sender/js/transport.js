// sender/js/transport.js
// Wraps BroadcastChannel('skyguard') behind exactly two exported functions:
// send(payload) and onReceive(callback)
// Robust cross-tab transport with message deduplication and localStorage synchronization.

const CHANNEL_NAME = 'skyguard';
let channel = null;

try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('[SkyGuard Transport] BroadcastChannel initialization warning:', e);
}

const subscribers = [];
const seenMessageIds = new Set();
const MAX_SEEN_IDS = 100;

function dispatchToSubscribers(data) {
  for (const cb of subscribers) {
    try {
      cb(data);
    } catch (err) {
      console.error('[SkyGuard Transport] Subscriber callback error:', err);
    }
  }
}

function handleIncomingEnvelope(envelope) {
  if (!envelope) return;

  // If envelope has ID, deduplicate across BroadcastChannel and storage events
  if (envelope._sg_id) {
    if (seenMessageIds.has(envelope._sg_id)) {
      return;
    }
    seenMessageIds.add(envelope._sg_id);
    if (seenMessageIds.size > MAX_SEEN_IDS) {
      const oldest = seenMessageIds.values().next().value;
      seenMessageIds.delete(oldest);
    }
    dispatchToSubscribers(envelope.data !== undefined ? envelope.data : envelope);
    return;
  }

  // Direct raw message fallback
  dispatchToSubscribers(envelope);
}

// Attach BroadcastChannel listener once
if (channel) {
  channel.addEventListener('message', (event) => {
    handleIncomingEnvelope(event.data);
  });
}

// Attach localStorage storage-event listener once for cross-window / cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'skyguard_transport_bus' && event.newValue) {
      try {
        const envelope = JSON.parse(event.newValue);
        handleIncomingEnvelope(envelope);
      } catch (_) {}
    }
  });
}

export function send(payload) {
  const envelope = {
    _sg_id: Math.random().toString(36).slice(2) + '-' + Date.now(),
    data: payload
  };

  // Record own message ID so we don't process our own storage echo
  seenMessageIds.add(envelope._sg_id);

  // 1. Post to BroadcastChannel
  if (channel) {
    try {
      channel.postMessage(envelope);
    } catch (err) {
      console.warn('[SkyGuard Transport] BroadcastChannel postMessage warning:', err);
    }
  }

  // 2. Sync to localStorage for tabs that navigated or opened via file://
  try {
    localStorage.setItem('skyguard_transport_bus', JSON.stringify(envelope));
  } catch (_) {}
}

export function onReceive(callback) {
  if (typeof callback === 'function') {
    subscribers.push(callback);
  }
}
