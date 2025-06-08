import React, { useState, useEffect } from "react";

const Targets = () => {
  const [usernames, setUsernames] = useState(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem("savedTargets");
    return saved ? JSON.parse(saved) : [];
  });
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Save to localStorage whenever usernames change
  useEffect(() => {
    localStorage.setItem("savedTargets", JSON.stringify(usernames));
  }, [usernames]);

  // Load saved usernames from backend and merge with localStorage
  useEffect(() => {
    fetch("http://localhost:5000/api/targets")
      .then((r) => r.json())
      .then((data) => {
        const backendTargets = data.targets || [];
        // Merge backend targets with local targets, removing duplicates
        setUsernames((prev) => {
          const combined = [...new Set([...prev, ...backendTargets])];
          return combined;
        });
      });
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
      {error && <div className="text-red-600 mb-2">{error}</div>}{" "}
      <div className="overflow-x-auto">
        {" "}
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Profile
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {usernames.length === 0 && (
              <tr>
                <td colSpan={3} className="text-gray-500 py-4 text-center">
                  No usernames saved.
                </td>
              </tr>
            )}
            {usernames.map((username) => (
              <tr key={username} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <a
                    href={`https://instagram.com/${username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Profile
                  </a>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(username);
                      setSuccess(`Username "${username}" copied to clipboard!`);
                      setTimeout(() => setSuccess(""), 3000);
                    }}
                    className="text-blue-600 hover:text-blue-800 mr-4"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => removeUsername(username)}
                    className="text-red-600 hover:text-red-800"
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
