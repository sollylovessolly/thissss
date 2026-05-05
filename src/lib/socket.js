// src/lib/socket.js

/**
 * The base WebSocket URL for the WhisperBox service.
 */
const WS_URL = "wss://whisperbox.koyeb.app/ws";

/**
 * Creates and initializes a WebSocket connection.
 * @param {string} token - The user's access token for authentication.
 * @param {Object} callbacks - An object containing event handlers (onMessage, onPresence, onError).
 */
export function createSocket(token, callbacks = {}) {
  // 1. Connection URL requirement from GUIDE.md
  // Using the exact structure from your previous working version
  const socket = new WebSocket(`${WS_URL}?token=${token}`);

  // 2. Destructure with default "no-op" functions to prevent "is not a function" errors
  const {
    onMessage = () => {},
    onPresence = () => {},
    onError = () => {},
  } = callbacks;

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // 3. Requirement: Handle different event types from the server
      // Supports both 'event' (from your GUIDE.md) and 'type' (common in many backends)
      const eventType = data.event || data.type;

      switch (eventType) {
        case "message.receive":
          // A new encrypted message has arrived
          onMessage(data);
          break;
        case "user.online":
        case "user.offline":
          // Handle presence notifications safely
          onPresence(data);
          break;
        case "error":
          console.error("Socket Error:", data.detail);
          onError(data);
          break;
        default:
          console.log("Unhandled WebSocket event:", eventType);
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  };

  socket.onopen = () => {
    console.log("WebSocket Connection Established");
  };

  socket.onclose = (e) => {
    console.log("WebSocket Connection Closed", e.reason);
  };

  socket.onerror = (error) => {
    console.error("WebSocket Transport Error:", error);
  };

  return socket;
}

/**
 * Helper function to format a message frame for sending.
 * @param {string} recipientId - The ID of the user receiving the message.
 * @param {string} encryptedPayload - The encrypted message content.
 */
export const formatMessageFrame = (recipientId, encryptedPayload) => {
  return JSON.stringify({
    event: "message.send", // Requirement from GUIDE.md
    to: recipientId,
    payload: encryptedPayload,
  });
};
