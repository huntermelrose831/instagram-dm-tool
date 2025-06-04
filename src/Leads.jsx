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
        setLeads(data.leads || []);
      } else setError(data.message || "Failed to fetch leads");
    } catch (e) {
      setError(e.message || "Failed to connect to backend");
    }
    setLoading(false);
  };

  const copyAllUsernames = () => {
    const usernames = leads
      .map((lead) => lead.ownerUsername || lead.username)
      .join("\n");
    navigator.clipboard.writeText(usernames);
  };

  const addToTargets = async () => {
    for (const lead of leads) {
      const username = lead.ownerUsername || lead.username;
      try {
        await fetch("http://localhost:5000/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
      } catch (err) {
        console.error(`Failed to add ${username} to targets:`, err);
      }
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Instagram Comment Leads</h2>
      <form onSubmit={fetchLeads} className="mb-6">
        <input
          type="text"
          placeholder="Enter Instagram post URL"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
          className="w-full p-3 text-base mb-3 border rounded"
        />
        <div className="flex flex-col gap-3">
          <button
            type="submit"
            className="w-full p-3 text-lg bg-blue-600 text-white border-none rounded cursor-pointer font-semibold disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Get Leads"}
          </button>
          {leads.length > 0 && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={copyAllUsernames}
                className="flex-1 p-2 text-sm bg-green-600 text-white border-none rounded cursor-pointer font-semibold"
              >
                Copy All Usernames
              </button>
              <button
                type="button"
                onClick={addToTargets}
                className="flex-1 p-2 text-sm bg-blue-500 text-white border-none rounded cursor-pointer font-semibold"
              >
                Add All to Targets
              </button>
            </div>
          )}
        </div>
      </form>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="text-center p-6">
            <div className="spinner mx-auto mb-3 w-10 h-10 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <div className="mt-2">Fetching leads...</div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : leads.length > 0 ? (
          <div>
            <h3 className="text-xl font-semibold mb-3">
              Found {leads.length} Leads:
            </h3>
            <div className="grid gap-4">
              {leads.map((lead, i) => (
                <div key={i} className="p-4 border rounded bg-white shadow-sm">
                  <div className="text-gray-600">
                    {lead.ownerUsername || lead.username}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-gray-600 text-center py-6">
            Enter a post URL above to fetch leads from its comments
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
