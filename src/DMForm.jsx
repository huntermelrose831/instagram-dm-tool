import React, { useState } from "react";

const DMForm = () => {
  const [login, setLogin] = useState({ username: "", password: "" });
  const [targets, setTargets] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLogin((prev) => ({ ...prev, [name]: value }));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setStatus("Sending...");
    try {
      const response = await fetch("http://localhost:5000/api/send-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: login.username,
          password: login.password,
          targets,
          message,
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
        <label className="block mb-1 font-medium">Instagram Username</label>
        <input
          type="text"
          name="username"
          value={login.username}
          onChange={handleChange}
          className="w-full border rounded px-2 py-1"
          required
        />
      </div>
      <div className="mb-3">
        <label className="block mb-1 font-medium">Instagram Password</label>
        <input
          type="password"
          name="password"
          value={login.password}
          onChange={handleChange}
          className="w-full border rounded px-2 py-1"
          required
        />
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
          placeholder="username1/"
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
