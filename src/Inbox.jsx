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
    return thread.participants.join(", ");
  };

  // Helper to get last message preview
  const getLastMsg = (thread) => {
    if (!thread.lastMsg) return "";
    return `${thread.lastMsg.user}: ${thread.lastMsg.text}`;
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
        {loading && <div className="p-4">Loading inbox...</div>}
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
            <div className="border-b px-6 py-4 font-bold text-lg">
              {getThreadName(activeThread)}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {activeThread.messages && activeThread.messages.length > 0 ? (
                activeThread.messages.map((msg, i) => (
                  <div key={i} className="">
                    <div className="font-semibold text-sm">{msg.user}</div>
                    <div className="bg-white rounded px-3 py-2 shadow-sm inline-block mt-1 mb-1">
                      {msg.text}
                    </div>
                    <div className="text-xs text-gray-400">
                      {msg.time && new Date(msg.time).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No messages in this thread.</div>
              )}
            </div>
            {/* Reply box */}
            <form
              className="flex items-center border-t p-4 bg-white"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const input = form.elements.reply;
                const text = input.value.trim();
                if (!text) return;
                // Send reply to backend (implement endpoint for this!)
                try {
                  const res = await fetch(`http://localhost:5000/api/reply`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: selected,
                      threadId: activeThread.threadId,
                      message: text,
                    }),
                  });
                  const data = await res.json();
                  if (data.status === "success") {
                    // Reload thread after sending
                    loadInbox(selected);
                    setActiveThread(null);
                  } else {
                    alert(data.message || "Failed to send reply");
                  }
                } catch (err) {
                  alert("Failed to connect to backend");
                }
                input.value = "";
              }}
            >
              <input
                name="reply"
                className="flex-1 border rounded px-3 py-2 mr-2"
                placeholder="Type a reply..."
                autoComplete="off"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded font-semibold hover:bg-blue-600"
              >
                Send
              </button>
            </form>
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
