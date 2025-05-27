import React, { useState } from "react";

const Accounts = () => {
  const [accounts, setAccounts] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem("igAccounts");
    return saved ? JSON.parse(saved) : [];
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Actually try to sign in to Instagram backend
  const handleAddAccount = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("Signing in...");
    if (!username || !password) {
      setError("Username and password required");
      setStatus("");
      return;
    }
    try {
      // Use the new backend endpoint for account login and cookie storage
      const response = await fetch("http://localhost:5000/api/add-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.status === "success") {
        // Fetch updated account list from backend
        const accountsRes = await fetch("http://localhost:5000/api/accounts");
        const accountsList = await accountsRes.json();
        setAccounts(accountsList);
        setUsername("");
        setPassword("");
        setStatus("Account added and signed in!");
      } else {
        setError(data.message || "Failed to sign in");
        setStatus("");
      }
    } catch (err) {
      setError("Failed to connect to backend");
      setStatus("");
    }
  };

  // Remove account by username (backend-driven)
  const handleRemove = async (idx) => {
    const usernameToRemove = accounts[idx].username;
    await fetch(`http://localhost:5000/api/accounts/${usernameToRemove}`, {
      method: "DELETE",
    });
    const accountsRes = await fetch("http://localhost:5000/api/accounts");
    const accountsList = await accountsRes.json();
    setAccounts(accountsList);
  };

  // On mount, load accounts from backend
  React.useEffect(() => {
    fetch("http://localhost:5000/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Instagram Accounts</h1>
      <form
        onSubmit={handleAddAccount}
        className="mb-6 bg-white p-4 rounded shadow"
      >
        <div className="mb-2">
          <label className="block mb-1 font-medium">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
        <div className="mb-2">
          <label className="block mb-1 font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        {status && <div className="text-green-700 mb-2">{status}</div>}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add & Sign In
        </button>
      </form>
      <h2 className="text-xl font-semibold mb-2">Saved Accounts</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b text-left">Username</th>
              <th className="py-2 px-4 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={2} className="text-gray-500 py-4 text-center">
                  No accounts added yet.
                </td>
              </tr>
            )}
            {accounts.map((acc, idx) => (
              <tr key={idx}>
                <td className="py-2 px-4 border-b font-mono">{acc.username}</td>
                <td className="py-2 px-4 border-b">
                  <button
                    onClick={() => handleRemove(idx)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
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

export default Accounts;
