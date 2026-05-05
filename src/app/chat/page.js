// src/app/chat/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/src/lib/api";
import { createSocket } from "@/src/lib/socket";
import { decryptHybrid } from "@/src/lib/crypto";

export default function ChatDashboard() {
  const { user, myPrivateKey, logout } = useAuth();
  const router = useRouter();
  const socketRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);

  // Guard — redirect if not logged in
  useEffect(() => {
    if (!user || !myPrivateKey) {
      router.push("/auth");
    }
  }, [user, myPrivateKey]);

  // Load conversations on mount
  useEffect(() => {
    if (!user) return;
    api.getConversations().then((data) => {
      setConversations(Array.isArray(data) ? data : []);
      setLoadingConvos(false);
    });
  }, [user]);

  // Connect WebSocket
  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (!token || !myPrivateKey) return;

    const ws = createSocket(token, {
      onMessage: async (frame) => {
        try {
          // Refresh conversations when new message arrives
          const updated = await api.getConversations();
          setConversations(Array.isArray(updated) ? updated : []);
        } catch {}
      },
      onPresence: () => {},
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
  }, [myPrivateKey]);

  // Search users with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchUsers(searchQuery);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const formatTime = (iso) => {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-full max-w-sm border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-white">Commugate</h1>
              <p className="text-zinc-500 text-xs">@{user?.username}</p>
            </div>
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-white p-2"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 text-sm transition-colors"
            />
          </div>
        </div>

        {/* E2EE badge */}
        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-zinc-900/50">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#22c55e">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          <span className="text-green-500 text-xs font-medium">
            End-to-end encrypted
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() ? (
            /* Search results */
            <div>
              {isSearching ? (
                <p className="text-zinc-500 text-sm text-center py-8">
                  Searching...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">
                  No users found
                </p>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSearchQuery("");
                      router.push(`/chat/${u.id}`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">
                        {u.display_name[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">
                        {u.display_name}
                      </p>
                      <p className="text-zinc-500 text-xs">@{u.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Conversations list */
            <div>
              {loadingConvos ? (
                <div className="space-y-1 p-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-2 py-3 animate-pulse"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-zinc-800 rounded w-1/3" />
                        <div className="h-3 bg-zinc-800 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <p className="text-white font-medium mb-1">
                    No conversations yet
                  </p>
                  <p className="text-zinc-500 text-sm">
                    Search for a user above to start messaging
                  </p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.user_id}
                    onClick={() => router.push(`/chat/${convo.user_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50"
                  >
                    <div className="w-11 h-11 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium">
                        {convo.display_name[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-white text-sm font-medium">
                          {convo.display_name}
                        </p>
                        <p className="text-zinc-500 text-xs">
                          {formatTime(convo.last_message_at)}
                        </p>
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        @{convo.username}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center opacity-30">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="#52525b"
            className="mx-auto mb-3"
          >
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
          <p className="text-zinc-500 text-sm">
            Select a conversation to start messaging
          </p>
        </div>
      </main>
    </div>
  );
}
