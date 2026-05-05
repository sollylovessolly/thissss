// src/lib/api.js
const BASE_URL = "https://whisperbox.koyeb.app";

let accessToken = "";

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      return fetch(`${BASE_URL}${path}`, { ...options, headers });
    }
  }

  return res;
}

async function tryRefreshToken() {
  try {
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    accessToken = data.access_token;
    return true;
  } catch {
    return false;
  }
}

export function startTokenRefresh() {
  setInterval(
    async () => {
      await tryRefreshToken();
    },
    14 * 60 * 1000,
  );
}

export const api = {
  register: (data) =>
    fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => res.json()),

  login: (username, password) =>
    fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then((res) => res.json()),

  refresh: (refreshToken) =>
    fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).then((res) => res.json()),

  searchUsers: async (query) => {
    const res = await apiFetch(`/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  },

  getPublicKey: async (userId) => {
    const res = await apiFetch(`/users/${userId}/public-key`);
    if (!res.ok) throw new Error("Failed to fetch public key");
    const data = await res.json();
    return data.public_key;
  },

  getConversations: async () => {
    const res = await apiFetch("/conversations");
    if (!res.ok) return [];
    return res.json();
  },

  getMessages: async (userId, before = null) => {
    const url = before
      ? `/conversations/${userId}/messages?limit=50&before=${encodeURIComponent(before)}`
      : `/conversations/${userId}/messages?limit=50`;
    const res = await apiFetch(url);
    if (!res.ok) return [];
    return res.json();
  },

  // ✅ Fixed: "to" not "recipient_id"
  sendMessage: async (recipientId, payload) => {
    const res = await apiFetch("/messages", {
      method: "POST",
      body: JSON.stringify({ to: recipientId, payload }),
    });
    if (!res.ok) throw new Error(`Send failed: ${res.status}`);
    return res.json();
  },
};
