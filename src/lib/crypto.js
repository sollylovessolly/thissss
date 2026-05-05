// convert buffers to Base64
const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const fromBase64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

export async function preparingRegistration(password) {
  //1. Gen. RSA_OAEP Keypair
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

  // 2. Export Public Key to Base64
  const exportedPublic = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );

  //setup PBKDF2 for password wrapping
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const wrappingKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );

  // 4. Wrap the Private Key
  const wrappedKey = await window.crypto.subtle.wrapKey(
    "pkcs8",
    keyPair.privateKey,
    wrappingKey,
    "AES-KW",
  );

  return {
    publicKey: toBase64(exportedPublic),
    wrappedKey: toBase64(wrappedKey),
    salt: toBase64(salt),
  };
}

export async function unwrapPrivateKey(password, wrappedKeyBase64, saltBase64) {
  // 1. Convert Base64 strings back to byte arrays
  const wrappedKeyBuffer = fromBase64(wrappedKeyBase64);
  const salt = fromBase64(saltBase64);

  // 2. Re-derive the "Wrapper Key" from the password
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
    { name: "AES-KW", length: 256 },
    false,
    ["unwrapKey"],
  );

  // 3. Unlock the Private Key!
  return await window.crypto.subtle.unwrapKey(
    "pkcs8",
    wrappedKeyBuffer,
    wrappingKey,
    { name: "AES-KW" },
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
}
