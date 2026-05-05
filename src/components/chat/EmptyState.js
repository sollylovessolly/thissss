export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-900/50 backdrop-blur-sm">
      <div className="w-20 h-20 bg-gray-800 rounded-3xl flex items-center justify-center mb-4 shadow-xl">
        <svg
          className="w-10 h-10 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white">Your Messages</h2>
      <p className="text-gray-400 mt-2 max-w-xs">
        Select a contact from the sidebar to start a secure, end-to-end
        encrypted conversation.
      </p>
    </div>
  );
}
