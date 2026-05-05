"use client";
import { useState } from "react";
import { api } from "@/src/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext"; // 1. ADD THIS IMPORT

export default function SidebarSearch({ onSelect }) {
  // Removed 'token' prop, we'll use context
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const { user } = useAuth(); // Now this works
  const router = useRouter();

  const startConversation = async (targetUser) => {
    // Prevent starting a chat with yourself
    if (targetUser.id === user?.user?.id) return;

    try {
      // 1. Fetch the recipient's public key (REQUIRED for encryption)
      const publicKeyData = await api.getPublicKey(
        targetUser.id,
        user.access_token,
      );

      // 2. Clear search state
      setQuery("");
      setResults([]);

      // 3. Navigate directly using the User ID
      // Your app/chat/[id]/page.js will treat [id] as the targetUser.id
      router.push(`/chat/${targetUser.id}`);
    } catch (err) {
      console.error("Error preparing chat:", err);
    }
  };

  const handleSearch = async (e) => {
    const val = e.target.value;
    setQuery(val);

    if (val.length >= 2 && user?.access_token) {
      setIsSearching(true);
      try {
        // Use user.access_token from context instead of prop
        const data = await api.searchUsers(val, user.access_token);

        if (Array.isArray(data)) {
          setResults(data);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Network search error:", err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setResults([]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <div className="relative">
          <input
            type="text"
            className="w-full bg-gray-800 text-sm border-none rounded-full py-2 px-10 focus:ring-2 focus:ring-blue-500 outline-none text-white"
            placeholder="Search for people..."
            value={query}
            onChange={handleSearch}
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {results.map((resultUser) => (
          <button
            key={resultUser.id}
            onClick={() => startConversation(resultUser)} // 2. CALL STARTCONVERSATION HERE
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800/10 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-sm font-bold text-white">
              {resultUser.display_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white truncate">
                {resultUser.display_name}
              </span>
              <span className="text-xs text-gray-500 truncate">
                @{resultUser.username}
              </span>
            </div>
          </button>
        ))}

        {isSearching && (
          <p className="text-center text-xs text-gray-500 mt-4 animate-pulse">
            Searching...
          </p>
        )}
      </div>
    </div>
  );
}
