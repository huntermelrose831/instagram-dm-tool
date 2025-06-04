import React, { useState, useEffect } from "react";

const Inbox = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeThread, setActiveThread] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  const loadInbox = async (username) => {
    setSelected(username);
    setLoading(true);
    setError("");
    setConvos([]);
    setActiveThread(null);
    try {
      const res = await fetch(`http://localhost:5000/api/inbox/${username}`);
      const data = await res.json();
      if (data.status === "success") {
        setConvos(data.conversations || []);
        if (data.conversations && data.conversations.length === 0) {
          setError(
            "No conversations found in your inbox. They may take a moment to load."
          );
        }
      } else {
        setError(data.message || "Failed to load inbox");
        console.error("Backend error:", data.message);
      }
    } catch (e) {
      console.error("Error loading inbox:", e);
      setError("Failed to load inbox. Please try again.");
    }
    setLoading(false);
  };

  // Helper to get display name for a thread
  const getThreadName = (thread) => {
    if (!thread.participants) return "Unknown";
    return (
      thread.participants.filter((name) => name !== selected).join(", ") ||
      thread.participants[0]
    );
  };

  // Helper to get last message preview
  const getLastMsg = (thread) => {
    if (!thread.lastMsg) return "";
    const isOwnMessage = thread.lastMsg.user === selected;
    return `${isOwnMessage ? "You" : thread.lastMsg.user}: ${thread.lastMsg.text}`;
  };

  // Helper to format message time
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="flex h-[80vh] max-w-5xl mx-auto bg-white rounded shadow overflow-hidden">
      {/* Sidebar: Conversation list */}
      <div className="w-1/3 border-r bg-gray-50 overflow-y-auto">
        <div className="p-4 border-b">
          <label className="block mb-1 font-medium">Select Account</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={selected}
            onChange={(e) => loadInbox(e.target.value)}
          >
            <option value="">-- Choose an account --</option>
            {accounts.map((acc) => (
              <option key={acc.username} value={acc.username}>
                {acc.username}
              </option>
            ))}
          </select>
        </div>
        {loading && (
          <div className="text-center p-6">
            <div className="spinner mx-auto mb-3 w-10 h-10 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <div className="mt-2">Loading inbox...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {error && <div className="text-red-600 p-4">{error}</div>}
        <ul>
          {convos.map((thread) => (
            <li
              key={thread.threadId}
              className={`cursor-pointer px-4 py-3 border-b hover:bg-gray-100 ${
                activeThread && activeThread.threadId === thread.threadId
                  ? "bg-gray-200"
                  : ""
              }`}
              onClick={() => setActiveThread(thread)}
            >
              <div className="font-semibold truncate">
                {getThreadName(thread)}
              </div>
              <div className="text-gray-600 text-sm truncate">
                {getLastMsg(thread)}
              </div>
            </li>
          ))}
          {convos.length === 0 && !loading && (
            <li className="text-gray-500 p-4 text-center">
              No conversations found.
            </li>
          )}
        </ul>
      </div>

      {/* Main: Message thread */}
      <div className="flex-1 flex flex-col">
        {activeThread ? (
          <>
            <div className="border-b px-6 py-4">
              <div className="font-bold text-lg">
                {getThreadName(activeThread)}
              </div>
              <div className="text-sm text-gray-500">
                {activeThread.participants.length} participants
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {activeThread.messages && activeThread.messages.length > 0 ? (
                activeThread.messages.map((msg, i) => {
                  const isOwnMessage = msg.user === selected;
                  return (
                    <div
                      key={i}
                      className={`flex ${
                        isOwnMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] ${
                          isOwnMessage ? "text-right" : "text-left"
                        }`}
                      >
                        {!isOwnMessage && (
                          <div className="font-semibold text-sm text-gray-700 mb-1">
                            {msg.user}
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 shadow-sm inline-block ${
                            isOwnMessage
                              ? "bg-blue-500 text-white rounded-br-none"
                              : "bg-white text-gray-800 rounded-bl-none"
                          }`}
                        >
                          {msg.text}
                          {msg.isLiked && (
                            <span className="ml-2 text-red-500">❤️</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatMessageTime(msg.time)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 text-center">
                  No messages in this conversation.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
            {selected
              ? "Select a conversation to view messages"
              : "Select an account to view your inbox"}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
