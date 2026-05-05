"use client";
import { useRef, useEffect } from "react";

export default function ChatWindow({ messages }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center opacity-30">
          <p className="text-sm italic">
            No messages yet. Say something encrypted.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isMe = msg.sender === "me";
          return (
            <div
              key={index}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={isMe ? "chat-bubble-me" : "chat-bubble-them"}>
                <p className="text-[15px] leading-relaxed">{msg.text}</p>
              </div>
              <span className="text-[10px] text-gray-500 mt-1 px-1 uppercase font-medium">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })
      )}
      <div ref={scrollRef} />
    </div>
  );
}
