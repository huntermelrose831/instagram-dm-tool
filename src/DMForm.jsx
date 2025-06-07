import React, { useState, useEffect } from "react";

const DMForm = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [targets, setTargets] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [useApify, setUseApify] = useState(false);

  useEffect(() => {
    fetch("http://localhost:5000/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    setStatus("Sending...");
    if (!selected) {
      setStatus("Please select an account.");
      return;
    }
    try {
      const response = await fetch("http://localhost:5000/api/send-dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selected,
          usernames: targets
            .split("\n")
            .map((u) => u.trim())
            .filter((u) => u !== ""),
          message,
          useApify,
        }),
      });
      const data = await response.json();
      setStatus(data.message || "Success!");
    } catch (err) {
      setStatus("Failed to send: " + err.message);
    }
  };

  return (
    <form
      className="max-w-md mx-auto p-4 bg-white rounded shadow"
      onSubmit={handleSend}
    >
      <h2 className="text-xl font-bold mb-4">Instagram DM Automation</h2>
      <div className="mb-3">
        <label className="block mb-1 font-medium">Select Account</label>
        <select
          className="w-full border rounded px-2 py-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          <option value="">-- Choose an account --</option>
          {accounts.map((acc) => (
            <option key={acc.username} value={acc.username}>
              {acc.username}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label className="block mb-1 font-medium">
          Target IG Usernames (one per line)
        </label>
        <textarea
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          className="w-full border rounded px-2 py-1"
          rows={3}
          placeholder="username1\nusername2"
          required
        />
      </div>
      <div className="mb-3">
        <label className="block mb-1 font-medium">DM Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border rounded px-2 py-1"
          rows={4}
          required
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Send
      </button>
      {status && <div className="mt-3 text-sm text-gray-700">{status}</div>}
    </form>
  );
};

export default DMForm;
