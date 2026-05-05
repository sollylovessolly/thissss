// src/app/chat/[id]/page.js
"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/src/lib/api";
import { createSocket } from "@/src/lib/socket";
import { encryptHybrid, decryptHybrid } from "@/src/lib/crypto";

const idsMatch = (left, right) => String(left) === String(right);

function contactStorageKey(userId) {
  return `commugate_contact_${userId}`;
}

function readStorageKey(myUserId, contactId) {
  return `commugate_read_at_${myUserId}_${contactId}`;
}

function getStoredContactName(userId) {
  if (typeof window === "undefined") return "";

  try {
    const stored = sessionStorage.getItem(contactStorageKey(userId));
    return stored ? JSON.parse(stored)?.display_name || "" : "";
  } catch {
    return "";
  }
}

export default function ChatPage({ params }) {
  const resolvedParams = use(params);
  const recipientId = resolvedParams.id;

  const { user, myPrivateKey, myPublicKeyB64 } = useAuth();
  const router = useRouter();
  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [recipientPublicKey, setRecipientPublicKey] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const recipientName = getStoredContactName(recipientId);

  useEffect(() => {
    if (!user || !myPrivateKey) {
      router.replace("/auth");
    }
  }, [user, myPrivateKey, router]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load recipient key + message history
  useEffect(() => {
    if (!user || !myPrivateKey || !recipientId) {
      return;
    }

    const init = async () => {
      setLoading(true);
      try {
        // 1. Get recipient's public key
        const pubKey = await api.getPublicKey(recipientId);
        setRecipientPublicKey(pubKey);

        // 2. Load message history
        const history = await api.getMessages(recipientId);

        // 3. Decrypt all messages — newest first from API, reverse for display
        const decrypted = await Promise.all(
          [...history].reverse().map(async (msg) => {
            const isSender = idsMatch(msg.from_user_id, user.id);
            try {
              const parsed = await decryptHybrid(
                msg.payload,
                myPrivateKey,
                isSender,
              );
              const text =
                typeof parsed === "string"
                  ? parsed
                  : (parsed?.content?.text ?? null);
              return { ...msg, text, decryptError: false };
            } catch {
              return { ...msg, text: null, decryptError: true };
            }
          }),
        );

        setMessages(decrypted);
        localStorage.setItem(
          readStorageKey(user.id, recipientId),
          new Date().toISOString(),
        );

      } catch (err) {
        console.error("Failed to load chat:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [recipientId, user, myPrivateKey]);

  // WebSocket for real-time
  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (!token || !myPrivateKey) return;

    const ws = createSocket(token, {
      onMessage: async (frame) => {
        // Only handle messages in this conversation
        if (
          !idsMatch(frame.from_user_id, recipientId) &&
          !idsMatch(frame.to_user_id, recipientId)
        )
          return;

        const isSender = idsMatch(frame.from_user_id, user?.id);
        try {
          const parsed = await decryptHybrid(
            frame.payload,
            myPrivateKey,
            isSender,
          );
          const text =
            typeof parsed === "string"
              ? parsed
              : (parsed?.content?.text ?? null);
          setMessages((prev) => {
            if (prev.find((m) => m.id === frame.id)) return prev;
            return [...prev, { ...frame, text, decryptError: false }];
          });
          localStorage.setItem(
            readStorageKey(user.id, recipientId),
            new Date().toISOString(),
          );
        } catch {
          setMessages((prev) => [
            ...prev,
            { ...frame, text: null, decryptError: true },
          ]);
          localStorage.setItem(
            readStorageKey(user.id, recipientId),
            new Date().toISOString(),
          );
        }
      },
      onPresence: (data) => {
        if (data.user_id === recipientId) {
          setIsOnline(data.event === "user.online");
        }
      },
      onError: () => {},
    });

    socketRef.current = ws;

    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.onmessage = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [recipientId, myPrivateKey, user]);

  const handleSend = async () => {
    if (!inputText.trim() || !recipientPublicKey || sending) return;

    const plaintext = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      // Encrypt for recipient + self
      const payload = await encryptHybrid(
        plaintext,
        recipientPublicKey,
        myPublicKeyB64,
      );

      // ✅ Use socketRef.current — not socket
      const frame = JSON.stringify({
        event: "message.send",
        to: recipientId,
        payload,
      });

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(frame);
      } else {
        // HTTP fallback
        await api.sendMessage(recipientId, payload);
      }

      // Optimistic UI update
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from_user_id: user.id,
          to_user_id: recipientId,
          payload,
          created_at: new Date().toISOString(),
          text: plaintext,
          decryptError: false,
        },
      ]);
    } catch (err) {
      console.error("Send failed:", err);
      setInputText(plaintext);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <button
          onClick={() => router.push("/chat")}
          className="text-zinc-400 hover:text-white p-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>

        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {recipientName
                ? recipientName[0].toUpperCase()
                : recipientId[0]?.toUpperCase()}
            </span>
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-zinc-900" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">
            {recipientName || "Chat"}
          </p>
          <p className="text-xs text-zinc-500">
            {isOnline ? (
              <span className="text-green-400">Online</span>
            ) : (
              "Offline"
            )}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#22c55e">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          <span className="text-green-500 text-xs">E2EE</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <svg
              className="animate-spin w-6 h-6 text-violet-500"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <p className="text-zinc-500 text-sm">
              No messages yet. Say something.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = idsMatch(msg.from_user_id, user?.id);
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-violet-600 rounded-br-sm" : "bg-zinc-800 rounded-bl-sm"}`}
                >
                  {msg.decryptError ? (
                    <p className="text-red-400 text-sm italic">
                      ⚠ Could not decrypt
                    </p>
                  ) : (
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      {typeof msg.text === "string"
                        ? msg.text
                        : msg.text?.content?.text}
                    </p>
                  )}
                  <p
                    className={`text-xs mt-1 ${isMine ? "text-violet-300" : "text-zinc-500"}`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </main>

      {/* Input */}
      <footer className="px-4 py-3 border-t border-zinc-800 bg-zinc-900">
        <div className="flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message..."
            rows={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none text-sm max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            {sending ? (
              <svg
                className="animate-spin w-4 h-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
