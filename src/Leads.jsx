import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Leads = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("posts");
  const [postUrl, setPostUrl] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addedLeads, setAddedLeads] = useState(new Set());
  const navigate = useNavigate();

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
    setAddedLeads(new Set()); // Reset added leads when fetching new ones
    try {
      // Different validation for different modes
      if (selected === "posts") {
        if (
          !postUrl.match(/^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+\/?/)
        ) {
          throw new Error("Please enter a valid Instagram post URL");
        }
      } else if (selected === "accounts") {
        if (
          !postUrl.match(/^https?:\/\/(www\.)?instagram\.com\/([^\/\?]+)\/?$/)
        ) {
          throw new Error("Please enter a valid Instagram profile URL");
        }
      } else if (selected === "hashtags") {
        if (!postUrl.trim()) {
          throw new Error("Please enter a hashtag");
        }
      } else if (selected === "keywords") {
        if (!postUrl.trim()) {
          throw new Error("Please enter keywords to search");
        }
      }

      const endpoint = selected;
      const res = await fetch(`http://localhost:5000/api/scrape/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setLeads(data.leads || []);
      } else {
        setError(data.message || "Failed to fetch leads");
      }
    } catch (e) {
      setError(e.message || "Failed to connect to backend");
    }
    setLoading(false);
  };

  const copyAllUsernames = () => {
    const usernames = leads.map((lead) => lead.username).join("\n");
    navigator.clipboard.writeText(usernames);
  };

  const addToTargets = async () => {
    setSuccess("");
    setError("");
    let addedCount = 0;
    try {
      for (const lead of leads) {
        try {
          const res = await fetch("http://localhost:5000/api/targets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: lead.username }),
          });
          const data = await res.json();
          if (data.status === "success") {
            setAddedLeads((prev) => new Set([...prev, lead.username]));
            addedCount++;
          }
        } catch (err) {
          console.error(`Failed to add ${lead.username} to targets:`, err);
        }
      }
      setSuccess(`Successfully added ${addedCount} leads to targets!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to add some leads to targets");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Find Leads</h2>
      <p className="text-gray-600 text-sm mb-6">
        How do you want to find leads?
      </p>

      <div className="grid grid-cols-4 gap-4 justify-center mb-10">
        <button
          className={`cursor-pointer p-6 border rounded shadow-sm text-center hover:bg-gray-100 ${
            selected === "accounts" ? "bg-gray-200" : ""
          }`}
          onClick={() => setSelected("accounts")}
        >
          <div className="flex justify-center mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 1115 0v.75H4.5v-.75z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold">FROM ACCOUNTS</span>
        </button>

        <button
          className={`cursor-pointer p-6 border rounded shadow-sm text-center hover:bg-gray-100 ${
            selected === "posts" ? "bg-gray-200" : ""
          }`}
          onClick={() => setSelected("posts")}
        >
          <div className="flex justify-center mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold">FROM POSTS</span>
        </button>

        <button
          className={`cursor-pointer p-6 border rounded shadow-sm text-center hover:bg-gray-100 ${
            selected === "hashtags" ? "bg-gray-200" : ""
          }`}
          onClick={() => setSelected("hashtags")}
        >
          <div className="flex justify-center mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold">HASHTAGS</span>
        </button>

        <button
          className={`cursor-pointer p-6 border rounded shadow-sm text-center hover:bg-gray-100 ${
            selected === "keywords" ? "bg-gray-200" : ""
          }`}
          onClick={() => setSelected("keywords")}
        >
          <div className="flex justify-center mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold">FROM KEYWORDS</span>
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-6">
        {selected === "posts"
          ? "Instagram Post Leads"
          : selected === "accounts"
            ? "Instagram Account Leads"
            : selected === "hashtags"
              ? "Instagram Hashtag Leads"
              : "Instagram Keyword Leads"}
      </h2>

      <form onSubmit={fetchLeads} className="mb-6">
        <input
          type="text"
          placeholder={
            selected === "posts"
              ? "Enter Instagram post URL"
              : selected === "accounts"
                ? "Enter Instagram account URL"
                : selected === "hashtags"
                  ? "Enter hashtag (e.g., programming)"
                  : "Enter keywords to search (e.g., web developer)"
          }
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
      {success && <div className="text-green-600 mb-4">{success}</div>}

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
                <div
                  key={i}
                  className={`p-4 border rounded shadow-sm transition-colors duration-300 ${
                    addedLeads.has(lead.username)
                      ? "bg-green-50 border-green-200"
                      : "bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-gray-600">{lead.username}</div>
                      {lead.caption && (
                        <div className="text-gray-400 text-sm mt-1">
                          {lead.caption}
                        </div>
                      )}
                    </div>
                    {addedLeads.has(lead.username) && (
                      <div className="text-green-600 text-sm">
                        Added to targets ✓
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-gray-600 text-center py-6">
            {selected === "posts"
              ? "Enter a post URL above to fetch leads"
              : selected === "accounts"
                ? "Enter an account URL above to fetch leads"
                : selected === "hashtags"
                  ? "Enter a hashtag above to fetch leads"
                  : "Enter keywords above to fetch leads"}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
