# Commugate E2EE Messenger

Commugate is a Next.js secure messaging client built for **Frontend Wizards - Stage 4B: End-to-End Encrypted App**. The application lets users register, sign in, search for other users, and exchange encrypted chat messages through the hosted WhisperBox backend.

The core security goal is simple: **message plaintext is created and decrypted only in the browser**. The backend receives public keys, encrypted private-key backups, encrypted message keys, IVs, and ciphertext blobs, but it is not given the decrypted message body.

## Submission Context

- **Stage:** 4B - End-to-End Encrypted App
- **Objective:** Build a secure messaging app using client-side encryption
- **Backend API:** `https://whisperbox.koyeb.app`
- **API docs:** `https://whisperbox.koyeb.app/docs#`
- **Frontend stack:** Next.js, React, Tailwind CSS, Web Crypto API
- **Main requirement:** Server must never need plaintext to store or deliver messages

## Features

- User registration and login against the WhisperBox API
- JWT-style access token handling with refresh-token support
- Browser-side RSA-OAEP key-pair generation during registration
- Password-derived AES-GCM wrapping for the private key
- Public-key lookup for recipients
- Hybrid message encryption with AES-GCM and RSA-OAEP
- Encrypted message sending over WebSocket with HTTP fallback
- Conversation list with decrypted latest-message previews when possible
- Real-time message updates through `wss://whisperbox.koyeb.app/ws`
- User search and one-to-one chat routing
- E2EE indicators in the conversation and chat UI
- Loading, empty, sending, offline, and decryption-failure states
- Graceful handling when a message cannot be decrypted

## Tech Stack

- **Next.js 16** with the App Router
- **React 19**
- **Tailwind CSS 4**
- **Web Crypto API**
- **lucide-react** for icons
- **WhisperBox REST and WebSocket APIs**

## Project Structure

```txt
.
|-- context/
|   `-- AuthContext.js              # Auth state, token setup, in-memory private key
|-- src/
|   |-- app/
|   |   |-- auth/page.js            # Login and registration UI
|   |   |-- chat/page.js            # Conversation dashboard
|   |   |-- chat/[id]/page.js       # One-to-one encrypted chat
|   |   |-- globals.css             # Tailwind and global styles
|   |   `-- layout.js               # AuthProvider wrapper
|   |-- components/
|   |   |-- chat/                   # Chat UI components
|   |   `-- sidebar/                # Sidebar UI components
|   |-- lib/
|   |   |-- api.js                  # REST API client and token refresh
|   |   |-- crypto.js               # Key generation, wrapping, encryption, decryption
|   |   |-- socket.js               # WebSocket client
|   |   `-- storage.js              # Reserved storage module
|   `-- hooks/
|       `-- useCrypto.js            # Reserved crypto hook
|-- package.json
`-- README.md
```

## Architecture

```txt
                    Registration / Login
                    --------------------

  Browser Client                                      WhisperBox Backend
  --------------                                      ------------------

  User password
       |
       v
  Web Crypto API
  - Generate RSA-OAEP key pair
  - Derive AES-GCM wrapping key with PBKDF2
  - Wrap private key with password-derived key
       |
       |  username, password, public_key,
       |  wrapped_private_key, pbkdf2_salt
       +---------------------------------------------> Store identity data
                                                       Return user + tokens


                    Encrypted Messaging
                    -------------------

  Sender Browser                                      Backend
  --------------                                      -------

  Plaintext message
       |
       v
  Generate random AES-GCM message key
       |
       v
  Encrypt message JSON with AES-GCM
       |
       v
  Encrypt AES key twice:
  - with recipient public RSA key
  - with sender public RSA key
       |
       |  ciphertext, iv, encryptedKey,
       |  encryptedKeyForSelf
       +---------------------------------------------> Store/deliver encrypted blob
                                                       No plaintext required


  Recipient Browser
  -----------------

  Receive encrypted blob
       |
       v
  Use local private RSA key to decrypt AES key
       |
       v
  Use AES-GCM key + IV to decrypt message JSON
       |
       v
  Render plaintext locally
```

## Encryption Design

The app uses a hybrid encryption scheme:

1. **RSA-OAEP identity keys**
   - Generated locally in `prepareRegistration()` inside `src/lib/crypto.js`.
   - Algorithm: `RSA-OAEP`
   - Modulus length: `2048`
   - Hash: `SHA-256`
   - Public exponent: `65537`
   - Public key export format: `spki`
   - Private key wrap format: `pkcs8`

2. **AES-GCM message encryption**
   - Each outgoing message gets a fresh random AES-GCM 256-bit content key.
   - Each message gets a fresh random 96-bit IV.
   - The plaintext is wrapped in a versioned JSON payload before encryption:

```json
{
  "v": "wb.message.v1",
  "content": {
    "kind": "text",
    "text": "message body"
  }
}
```

3. **RSA-OAEP key exchange**
   - The raw AES message key is encrypted with the recipient public key as `encryptedKey`.
   - The same AES message key is also encrypted with the sender public key as `encryptedKeyForSelf`.
   - This allows both the recipient and sender to decrypt the same stored message from history.

4. **Decryption**
   - `decryptHybrid()` chooses the recipient key slot or sender key slot depending on who is reading the message.
   - The private RSA key decrypts the AES content key.
   - The AES key decrypts the message body.
   - If any step fails, the UI shows a decryption error instead of crashing.

## Key Management

### During Registration

Registration is handled in `src/app/auth/page.js` and `src/lib/crypto.js`.

1. The browser generates an RSA-OAEP key pair.
2. The user's password is imported into PBKDF2.
3. PBKDF2 derives an AES-GCM wrapping key using:
   - 16-byte random salt
   - 100,000 iterations
   - SHA-256
4. The private key is wrapped with AES-GCM.
5. The app sends the backend:
   - `public_key`
   - `wrapped_private_key`
   - `pbkdf2_salt`
   - account fields required by the API
6. The raw private key is never sent to the backend.

### During Login

1. The backend returns the user's wrapped private key and PBKDF2 salt.
2. The browser derives the wrapping key again from the entered password.
3. The browser unwraps the private key with Web Crypto.
4. The unwrapped private key is kept in React state for the active session.
5. The public key and auth tokens are stored in `sessionStorage` so refresh/navigation can continue during the tab session.

### Storage Choices

- **Private key:** held in memory after login.
- **Wrapped private key:** stored by the backend as encrypted backup material.
- **Public key:** stored by the backend and cached in `sessionStorage`.
- **Access token and refresh token:** stored in `sessionStorage`.
- **Read timestamps and lightweight contact cache:** stored client-side for UI state.

The current implementation avoids storing the raw private key in `localStorage`. A production version should consider IndexedDB plus additional hardening for session recovery and device management.

## Authentication and API Flow

The REST client is implemented in `src/lib/api.js`.

- `POST /auth/register` creates an account with public key material.
- `POST /auth/login` returns the authenticated user, token data, wrapped private key, and salt.
- `POST /auth/refresh` refreshes the access token.
- `GET /users/search?q=...` finds users.
- `GET /users/{id}/public-key` retrieves a recipient public key.
- `GET /conversations` loads conversation metadata.
- `GET /conversations/{id}/messages?limit=50` loads encrypted message history.
- `POST /messages` sends an encrypted payload when WebSocket is unavailable.
- `wss://whisperbox.koyeb.app/ws?token=...` delivers real-time message and presence events.

The API client keeps the access token in module memory and retries authenticated requests after a refresh attempt when it receives `401`.

## Message Flow

### Sending a Message

1. User opens `/chat/[id]`.
2. Client fetches the recipient's public key.
3. User writes a plaintext message in the browser.
4. `encryptHybrid()` creates an encrypted payload.
5. The app sends only the encrypted payload to the backend.
6. The UI optimistically renders the local plaintext copy for the sender.

Payload shape sent to the backend:

```json
{
  "ciphertext": "base64 AES-GCM ciphertext",
  "iv": "base64 AES-GCM IV",
  "encryptedKey": "base64 RSA-OAEP encrypted AES key for recipient",
  "encryptedKeyForSelf": "base64 RSA-OAEP encrypted AES key for sender"
}
```

### Receiving a Message

1. Backend delivers a WebSocket event or the client loads history through REST.
2. The client reads the encrypted payload.
3. `decryptHybrid()` attempts to decrypt the message key with the local private key.
4. If successful, the message body is decrypted and rendered.
5. If unsuccessful, the UI displays `Could not decrypt`.

## UI and UX

The interface is inspired by modern messaging apps:

- Dark, focused chat shell
- Conversation sidebar
- Search-first contact discovery
- Bubble-based message layout
- E2EE badge in dashboard and chat header
- Online/offline indicator hooks through presence events
- Skeleton loading states for conversations
- Send-button loading state
- Decryption failure fallback message
- Empty conversation and no-conversation states

## Security Trade-offs

This project implements the required E2EE foundation, but it intentionally keeps some areas simple for the assessment scope.

### Strengths

- Plaintext is encrypted before it leaves the browser.
- Backend stores encrypted message blobs, not message text.
- Raw private keys are not sent to the backend.
- Private keys are wrapped with a password-derived AES-GCM key.
- AES-GCM uses a fresh random IV per private-key wrap and per message.
- A fresh AES-GCM content key is generated per message.
- Decryption failures are handled gracefully.
- Sender and recipient can both decrypt history without exposing the AES key to the server.

### Trade-offs and Risks

- Tokens are stored in `sessionStorage`; this is better than long-lived `localStorage`, but still exposed to injected JavaScript in an XSS event.
- The wrapped private key is returned by the backend during login, so password strength matters.
- PBKDF2 uses 100,000 iterations; stronger memory-hard KDFs such as Argon2id would be preferable where available.
- RSA-OAEP 2048 is acceptable for this assignment, but modern messaging systems often use elliptic-curve protocols designed for forward secrecy.
- The app does not currently verify public-key fingerprints out of band, so a malicious or compromised backend could theoretically substitute a public key.
- Message metadata remains visible to the backend, including sender, recipient, timestamps, and message frequency.
- No message signatures are implemented, so cryptographic sender authentication is limited to authenticated transport/API identity.
- No replay protection is implemented beyond backend message IDs/timestamps and normal API behavior.
- No forward secrecy is implemented; if a user's private key and wrapped key password are compromised, old message keys encrypted for that identity may be recoverable.

## Known Limitations

- No IndexedDB private-key persistence yet; the raw private key exists only in memory after login.
- Refresh tokens are currently stored in `sessionStorage`.
- No multi-device key synchronization or device approval flow.
- No contact key verification/fingerprint UI.
- No encrypted attachments, reactions, typing indicators, or group chats.
- No local encrypted message cache; history is fetched from the backend.
- No formal test suite is included yet.
- Some reserved component/hook files exist from earlier iteration work and are not part of the active route flow.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

The home page redirects to `/auth`, where users can register or log in.

## Available Scripts

```bash
npm run dev      # Start the local development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
```

## Verification Checklist

- Registering creates key material in the browser.
- The registration request includes only the public key and wrapped private key.
- Login unwraps the private key client-side using the entered password.
- Sending a message calls `encryptHybrid()` before network transmission.
- Stored/sent message payloads contain ciphertext and encrypted AES keys, not plaintext.
- Receiving a message calls `decryptHybrid()` in the browser.
- Failed decryptions do not break the chat UI.
- Conversation previews are decrypted locally when the private key is available.

## Future Improvements

- Move key persistence to IndexedDB with additional encryption and device scoping.
- Add public-key fingerprint display and manual verification.
- Add message signatures for stronger sender authenticity.
- Add replay detection using message nonces or monotonically checked counters.
- Add Double Ratchet or another forward-secret protocol.
- Add encrypted attachment support.
- Add automated tests for crypto payload shape and auth/message flows.
- Add stronger XSS defenses, including strict CSP and hardened token handling.

## Assessment Mapping

| Requirement | Implementation |
| --- | --- |
| Secure login and session management | Login/register pages, access token, refresh token, guarded chat routes |
| Public/private key pair | RSA-OAEP generated through Web Crypto API |
| Public key stored on backend | Sent during registration as `public_key` |
| Private key never leaves client raw | Wrapped with AES-GCM before backend storage |
| Encrypted messaging | AES-GCM ciphertext plus RSA-OAEP encrypted message key |
| Server never sees plaintext | Only encrypted payloads are sent through REST/WebSocket |
| Clear encrypted indicator | E2EE badges in sidebar and chat header |
| Loading and error states | Auth errors, skeletons, sending state, decrypt failure fallback |
| Documentation quality | Architecture, flows, trade-offs, limitations, and setup documented here |
