import { useState } from "react";

export default function ChatInput({ onSend }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="p-4 bg-gray-800/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto flex items-center gap-3 bg-gray-700 rounded-full px-4 py-2">
        <button className="text-gray-400 hover:text-blue-400">+</button>
        <input
          className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white"
          placeholder="iMessage"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button
          onClick={submit}
          className="bg-blue-500 rounded-full p-1.5 transition hover:scale-105"
        >
          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
