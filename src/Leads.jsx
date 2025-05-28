import React, { useState, useEffect } from "react";

const Leads = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  const fetchLeads = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLeads([]);
    try {
      // Validate URL format
      if (!postUrl.match(/^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+\/?/)) {
        throw new Error(
          "Please enter a valid Instagram post URL (e.g., https://instagram.com/p/ABC123)"
        );
      }
      const res = await fetch("http://localhost:5000/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setLeads(Array.isArray(data.usernames) ? data.usernames : []);
      } else setError(data.message || "Failed to fetch usernames");
    } catch (e) {
      setError(e.message || "Failed to connect to backend");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
        Instagram Comment Usernames
      </h2>
      <form onSubmit={fetchLeads} style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Enter Instagram post URL"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
          style={{ width: "100%", padding: 12, fontSize: 16, marginBottom: 12 }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            fontSize: 18,
            background: "#3182ce",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
          }}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Get Usernames"}
        </button>
      </form>
      {error && (
        <div style={{ color: "#e53e3e", marginBottom: 16 }}>{error}</div>
      )}
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <div
              className="spinner"
              style={{
                margin: "0 auto 12px",
                width: 40,
                height: 40,
                border: "4px solid #cbd5e0",
                borderTop: "4px solid #3182ce",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ marginTop: 8 }}>Fetching usernames...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : leads.length > 0 ? (
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              Found {leads.length} Usernames:
            </h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {leads.map((username, index) => (
                <li
                  key={index}
                  style={{
                    padding: 8,
                    background: index % 2 === 0 ? "#f7fafc" : "#edf2f7",
                    borderRadius: 4,
                    marginBottom: 4,
                    fontSize: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>@{username}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(username);
                      alert(`Copied @${username} to clipboard`);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3182ce",
                      cursor: "pointer",
                      fontSize: 14,
                      marginRight: 8,
                    }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          "http://localhost:5000/api/targets",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username }),
                          }
                        );
                        const data = await res.json();
                        if (data.status === "success") {
                          alert(`@${username} added to targets!`);
                        } else {
                          alert(`Failed to add: ${data.message}`);
                        }
                      } catch (e) {
                        alert("Failed to add target.");
                      }
                    }}
                    style={{
                      background: "#38a169",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Add to Targets
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          !loading && (
            <div style={{ color: "#666", marginTop: 16 }}>
              No usernames found for this post.
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Leads;
