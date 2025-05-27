import React, { useState, useEffect } from "react";

const Targets = () => {
  const [targets, setTargets] = useState([]);
  const [newTarget, setNewTarget] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load saved targets from backend
  useEffect(() => {
    fetch("http://localhost:5000/api/targets")
      .then((r) => r.json())
      .then((data) => setTargets(data.targets || []));
  }, []);

  // Add a new target
  const addTarget = async (username) => {
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
        setTargets(data.targets);
        setSuccess("Target added!");
        setNewTarget("");
      } else {
        setError(data.message || "Failed to add target");
      }
    } catch (e) {
      setError("Failed to connect to backend");
    }
  };

  // Remove a target
  const removeTarget = async (username) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`http://localhost:5000/api/targets/${username}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.status === "success") {
        setTargets(data.targets);
      } else {
        setError(data.message || "Failed to remove target");
      }
    } catch (e) {
      setError("Failed to connect to backend");
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Saved Targets</h1>
      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addTarget(newTarget.trim());
        }}
      >
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="Add Instagram username"
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-1 rounded font-semibold hover:bg-blue-600"
          disabled={!newTarget.trim()}
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
            {targets.length === 0 && (
              <tr>
                <td colSpan={3} className="text-gray-500 py-4 text-center">
                  No targets saved.
                </td>
              </tr>
            )}
            {targets.map((t, i) => (
              <tr key={i}>
                <td className="py-2 px-4 border-b">{t}</td>
                <td className="py-2 px-4 border-b">
                  <a
                    href={`https://instagram.com/${t}`}
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
                    onClick={() => removeTarget(t)}
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
