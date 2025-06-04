import React, { useState, useEffect } from "react";

const Targets = () => {
  const [usernames, setUsernames] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load saved usernames from backend
  useEffect(() => {
    fetch("http://localhost:5000/api/targets")
      .then((r) => r.json())
      .then((data) => setUsernames(data.targets || []));
  }, []);

  // Add a new username
  const addUsername = async (username) => {
    setError("");
    setSuccess("");
    if (!username) return;
    try {
      const res = await fetch("http://localhost:5000/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setUsernames(data.targets);
        setSuccess("Username added!");
        setNewUsername("");
      } else {
        setError(data.message || "Failed to add username");
      }
    } catch (e) {
      setError("Failed to connect to backend");
    }
  };

  // Remove a username
  const removeUsername = async (username) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`http://localhost:5000/api/targets/${username}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.status === "success") {
        setUsernames(data.targets);
      } else {
        setError(data.message || "Failed to remove username");
      }
    } catch (e) {
      setError("Failed to connect to backend");
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Saved Usernames</h1>
        {usernames.length > 0 && (
          <button
            onClick={() => {
              const allUsernames = usernames.join("\n");
              navigator.clipboard.writeText(allUsernames);
              setSuccess("All usernames copied to clipboard!");
              setTimeout(() => setSuccess(""), 3000);
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded font-semibold hover:bg-blue-600 text-sm"
          >
            Copy All Usernames
          </button>
        )}
      </div>
      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addUsername(newUsername.trim());
        }}
      >
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="Add Instagram username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-1 rounded font-semibold hover:bg-blue-600"
          disabled={!newUsername.trim()}
        >
          Add
        </button>
      </form>
      {success && <div className="text-green-600 mb-2">{success}</div>}
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b text-left">Username</th>
              <th className="py-2 px-4 border-b text-left">Profile</th>
              <th className="py-2 px-4 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usernames.length === 0 && (
              <tr>
                <td colSpan={3} className="text-gray-500 py-4 text-center">
                  No usernames saved.
                </td>
              </tr>
            )}
            {usernames.map((u, i) => (
              <tr key={i}>
                <td className="py-2 px-4 border-b">{u}</td>
                <td className="py-2 px-4 border-b">
                  <a
                    href={`https://instagram.com/${u}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Profile
                  </a>
                </td>
                <td className="py-2 px-4 border-b">
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => removeUsername(u)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Targets;
