// src/lib/crypto.js

const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

export async function importPublicKey(base64Key) {
  return window.crypto.subtle.importKey(
    "spki",
    fromBase64(base64Key),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function prepareRegistration(password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const wrappingKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const wrappedBinary = await window.crypto.subtle.wrapKey(
    "pkcs8",
    keyPair.privateKey,
    wrappingKey,
    { name: "AES-GCM", iv },
  );

  const combined = new Uint8Array(iv.length + wrappedBinary.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(wrappedBinary), iv.length);

  const exportedPublic = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );

  return {
    publicKey: toBase64(exportedPublic),
    wrappedKey: toBase64(combined),
    salt: toBase64(salt),
    privateKey: keyPair.privateKey, // return for immediate use in session
  };
}

export async function unwrapPrivateKey(password, wrappedKeyBase64, saltBase64) {
  const combined = fromBase64(wrappedKeyBase64);
  const salt = fromBase64(saltBase64);
  const iv = combined.slice(0, 12);
  const wrappedData = combined.slice(12);

  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const wrappingKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["unwrapKey"],
  );

  return window.crypto.subtle.unwrapKey(
    "pkcs8",
    wrappedData,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
}

export async function encryptHybrid(
  plaintext,
  recipientPublicKeyBase64,
  ownPublicKeyBase64,
) {
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const payload = JSON.stringify({
    v: "wb.message.v1",
    content: {
      kind: "text",
      text: plaintext,
    },
  });

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(payload),
  );

  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  const recipientKey = await importPublicKey(recipientPublicKeyBase64);
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientKey,
    rawAesKey,
  );

  const selfKey = await importPublicKey(ownPublicKeyBase64);
  const encryptedKeyForSelf = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    selfKey,
    rawAesKey,
  );

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    encryptedKey: toBase64(encryptedKey),
    encryptedKeyForSelf: toBase64(encryptedKeyForSelf),
  };
}

// ✅ Fixed: isSender flag to pick the right encrypted key
export async function decryptHybrid(payload, myPrivateKey, isSender = false) {
  const encryptedKeyForSelf =
    payload.encryptedKeyForSelf || payload.encrypted_key_for_self;
  const encryptedKey = payload.encryptedKey || payload.encrypted_key;
  const keyCandidates = isSender
    ? [encryptedKeyForSelf, encryptedKey]
    : [encryptedKey, encryptedKeyForSelf];

  let rawAesKey;
  let lastError;

  for (const keyToDecrypt of keyCandidates.filter(Boolean)) {
    try {
      rawAesKey = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        myPrivateKey,
        fromBase64(keyToDecrypt),
      );
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawAesKey) {
    throw lastError || new Error("No encrypted message key available");
  }

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAesKey,
    "AES-GCM",
    false,
    ["decrypt"],
  );

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    aesKey,
    fromBase64(payload.ciphertext),
  );

  const decoded = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decoded);
}
