import React, { useState, useEffect, useCallback } from "react";
import {
  FaSearch,
  FaUsers,
  FaPlus,
  FaHashtag,
  FaInstagram,
  FaGlobe,
  FaSpinner,
  FaDownload,
  FaUserPlus,
  FaMapMarkerAlt,
  FaFilter,
  FaTrash,
  FaCrosshairs,
} from "react-icons/fa";

const Leads = () => {
  // Main tab state
  const [activeTab, setActiveTab] = useState("discovery");

  // Advanced lead filters
  const [filterProfilePic, setFilterProfilePic] = useState(false);
  const [filterBio, setFilterBio] = useState(false);
  const [filterWebsite, setFilterWebsite] = useState(false);
  const [filterAccountType, setFilterAccountType] = useState("both"); // "private", "business", "both"
  const [filterFollowers, setFilterFollowers] = useState({ min: "", max: "" });
  const [filterPosts, setFilterPosts] = useState({ min: "", max: "" });
  // Max posts filter for hashtag/keyword searches (1-10)
  const [filterMaxPosts, setFilterMaxPosts] = useState(10);

  // Original Leads functionality
  const [searchType, setSearchType] = useState("posts");
  const [searchInput, setSearchInput] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addedLeads, setAddedLeads] = useState(new Set());
  const [selectedLeads, setSelectedLeads] = useState(new Set());

  // Advanced Targeting functionality - now Targets functionality
  const [targets, setTargets] = useState([]);
  const [newTarget, setNewTarget] = useState("");
  const [bulkTargets, setBulkTargets] = useState("");
  const [targetSearchTerm, setTargetSearchTerm] = useState("");

  const searchTypes = [
    { value: "posts", label: "Instagram Posts", icon: FaInstagram },
    { value: "accounts", label: "Profile Followers", icon: FaUsers },
    { value: "hashtags", label: "Hashtag Search", icon: FaHashtag },
    { value: "keywords", label: "Keyword Search", icon: FaSearch },
  ];

  // Initialize data on component mount
  useEffect(() => {
    if (activeTab === "advanced") {
      fetchTargets();
    }
    fetchAccounts();
  }, [activeTab]);

  // Fetch available accounts for follower scraping
  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts`);
      if (response.ok) {
        const accountsData = await response.json();
        setAccounts(accountsData || []);
        // Set first account as default if available
        if (accountsData && accountsData.length > 0) {
          setSelectedAccount(accountsData[0].username);
        }
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  // Memoized input handlers to prevent re-rendering issues
  const handleSearchTypeChange = useCallback((value) => {
    setSearchType(value);
  }, []);

  const handleSearchInputChange = useCallback((value) => {
    setSearchInput(value);
  }, []);

  const handleNewTargetChange = useCallback((value) => {
    setNewTarget(value);
  }, []);

  const handleBulkTargetsChange = useCallback((value) => {
    setBulkTargets(value);
  }, []);

  const handleTargetSearchTermChange = useCallback((value) => {
    setTargetSearchTerm(value);
  }, []);

  // Targets functionality
  // Use Vite environment variable or fallback for API base URL
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:5001"
      : "https://app.turbodm.pro");

  const fetchTargets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/targets`);
      if (response.ok) {
        const data = await response.json();
        setTargets(data.targets || []);
      }
    } catch (error) {
      console.error("Error fetching targets:", error);
    }
  };

  const addTarget = async (username) => {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/targets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();
      if (data.status === "success") {
        setTargets(data.targets);
        setSuccess("Target added successfully!");
        setNewTarget("");
        setTimeout(() => setSuccess(""), 3000);
        // Fixed syntax: removed stray semicolon inside setTimeout callback
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to add target");
      }
    } catch (error) {
      setError("Network error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addBulkTargets = async () => {
    if (!bulkTargets.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const targetList = bulkTargets
      .split(/[,\n]/)
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      for (const username of targetList) {
        await addTarget(username);
      }
      setBulkTargets("");
      setSuccess(`Added ${targetList.length} targets successfully!`);
    } catch (error) {
      setError("Error adding bulk targets");
    } finally {
      setLoading(false);
    }
  };

  const removeTarget = async (username) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/targets/${username}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.status === "success") {
        setTargets(data.targets);
        setSuccess("Target removed successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      setError("Failed to remove target");
    } finally {
      setLoading(false);
    }
  };

  const clearAllTargets = async () => {
    if (!window.confirm("Are you sure you want to clear all targets?")) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/targets/clear`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.status === "success") {
        setTargets([]);
        setSuccess("All targets cleared successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      setError("Failed to clear targets");
    } finally {
      setLoading(false);
    }
  };

  const exportTargets = async (format = "json") => {
    try {
      setLoading(true);

      // Call the backend API to get the real targets data
      const response = await fetch(
        `/api/targeting/leads/export?format=${format}`,
      );

      if (!response.ok) {
        throw new Error("Failed to export targets");
      }

      // Get the filename from the response headers or create one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `targets_export_${Date.now()}.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Handle different response types
      if (format === "csv") {
        const csvData = await response.text();
        const blob = new Blob([csvData], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const jsonData = await response.json();
        const dataStr = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }

      setSuccess(`Targets exported successfully as ${format.toUpperCase()}!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Export error:", error);
      setError(`Failed to export targets: ${error.message}`);
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const copyAllTargets = () => {
    const targetsText = targets.map((target) => `@${target}`).join("\n");
    navigator.clipboard
      .writeText(targetsText)
      .then(() => {
        setSuccess("All targets copied to clipboard!");
        setTimeout(() => setSuccess(""), 3000);
      })
      .catch(() => {
        setError("Failed to copy targets to clipboard");
      });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setLoading(true);
    setError("");
    setLeads([]);
    setAddedLeads(new Set());
    setSelectedLeads(new Set());

    try {
      // Validate input based on search type
      if (
        searchType === "posts" &&
        !searchInput.match(/^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+\/?/)
      ) {
        throw new Error("Please enter a valid Instagram post URL");
      }
      if (
        searchType === "accounts" &&
        !searchInput.match(/^https?:\/\/(www\.)?instagram\.com\/([^\/\?]+)\/?$/)
      ) {
        throw new Error("Please enter a valid Instagram profile URL");
      }

      // Prepare request body based on search type
      let requestBody = {};
      if (searchType === "posts") {
        // For posts scraping, we need both the post URL and an Instagram account to use
        if (!selectedAccount) {
          throw new Error(
            "Please select an Instagram account to use for scraping",
          );
        }
        requestBody = {
          postUrl: searchInput,
          igUsername: selectedAccount,
        };
      } else if (searchType === "accounts") {
        // For accounts scraping, we need both the profile URL and an Instagram account to use
        if (!selectedAccount) {
          throw new Error(
            "Please select an Instagram account to use for scraping",
          );
        }
        requestBody = {
          postUrl: searchInput, // Backend expects 'postUrl' for profile URL
          igUsername: selectedAccount,
        };
      } else if (searchType === "hashtags") {
        // Hashtag endpoint expects 'postUrl' containing the hashtag and optionally igUsername
        requestBody = {
          postUrl: searchInput,
          igUsername: selectedAccount || undefined, // Optional for hashtags
          maxPosts: filterMaxPosts, // Pass the max posts filter
        };
      } else if (searchType === "keywords") {
        // Keywords endpoint expects 'postUrl' containing the keywords and optionally igUsername
        requestBody = {
          postUrl: searchInput,
          igUsername: selectedAccount || undefined, // Optional for keywords
          maxPosts: filterMaxPosts, // Pass the max posts filter
        };
      } else {
        // Fallback for any other search types
        requestBody = { query: searchInput };
      }

      const response = await fetch(`${API_BASE_URL}/api/scrape/${searchType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (data.status === "success") {
        const leadsData = data.leads || data.usernames || [];
        setLeads(leadsData);
        setSuccess(`Found ${leadsData.length} leads!`);
      } else {
        setError(data.message || "Failed to fetch leads");
      }
    } catch (error) {
      setError(error.message);
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const addAllToTargets = () => {
    const unadded = leads.filter((lead) =>
      typeof lead === "string"
        ? !addedLeads.has(lead)
        : !addedLeads.has(lead.username),
    );
    unadded.forEach((lead) => {
      const username = typeof lead === "string" ? lead : lead.username;
      addToTargets(username);
    });
  };

  const addToTargets = async (username) => {
    if (!username || addedLeads.has(username)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/leads/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: [
            {
              username,
              source: "manual",
              status: "new",
              isTarget: true,
              addedToTargets: true,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.status === "success") {
        setAddedLeads((prev) => new Set([...prev, username]));
        setSuccess(`Added ${username} to targets successfully!`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to add to targets");
      }
    } catch (error) {
      console.error("Error adding to targets:", error);
      setError("Failed to add to targets");
    }
  };

  const handleLeadSelection = (username) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(username)) {
        newSet.delete(username);
      } else {
        newSet.add(username);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allUsernames = leads
      .filter((lead) => {
        const username = typeof lead === "string" ? lead : lead.username;
        return !addedLeads.has(username);
      })
      .map((lead) => (typeof lead === "string" ? lead : lead.username));

    setSelectedLeads(new Set(allUsernames));
  };

  const handleDeselectAll = () => {
    setSelectedLeads(new Set());
  };

  const addSelectedToTargets = async () => {
    if (selectedLeads.size === 0) return;

    try {
      const leadsToSave = Array.from(selectedLeads).map((username) => ({
        username,
        source: "scraped",
        status: "new",
        isTarget: true,
        addedToTargets: true,
      }));

      const response = await fetch(`${API_BASE_URL}/api/leads/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leads: leadsToSave }),
      });

      const data = await response.json();
      if (data.status === "success") {
        setAddedLeads((prev) => new Set([...prev, ...selectedLeads]));
        setSelectedLeads(new Set());
        setSuccess(`Added ${data.savedCount} leads to targets successfully!`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to add selected leads to targets");
      }
    } catch (error) {
      console.error("Error adding selected leads to targets:", error);
      setError("Failed to add selected leads to targets");
    }
  };

  const exportLeads = (source = "discovery", format = "json") => {
    if (source === "discovery") {
      // Export simple leads from discovery search results
      const dataToExport = leads;
      const filename = `leads_${searchType}_${Date.now()}.${format}`;

      if (format === "csv") {
        const csvContent =
          "Username\n" +
          leads
            .map((lead) => {
              const username = typeof lead === "string" ? lead : lead.username;
              return `"${username}"`;
            })
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename.replace(".json", ".csv");
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // JSON export
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }
    } else if (source === "targets") {
      // Export targets from backend
      const url = `/api/leads/export?source=targets&format=${format}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = `targets_export.${format === "csv" ? "csv" : "json"}`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-black flex items-center">
            <FaSearch className="mr-3 text-purple-600" />
            Lead Management & Targeting
          </h1>
          <p className="text-gray-600 mt-2">
            Discover leads through simple searches or advanced automated
            targeting
          </p>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-4">
            <button
              onClick={() => setActiveTab("discovery")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "discovery"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FaSearch className="inline mr-2" />
              Lead Discovery
            </button>
            <button
              onClick={() => setActiveTab("advanced")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "advanced"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FaCrosshairs className="inline mr-2" />
              Targets
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === "discovery" ? (
            // Original Lead Discovery Interface
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* ...existing code... */}

              {/* Search Section */}
              <div className="lg:col-span-1 space-y-6">
                {/* Search Type Selection */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-black mb-4">
                    Search Type
                  </h2>
                  <div className="space-y-3">
                    {searchTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <label
                          key={type.value}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                            searchType === type.value
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="searchType"
                            value={type.value}
                            checked={searchType === type.value}
                            onChange={(e) =>
                              handleSearchTypeChange(e.target.value)
                            }
                            className="sr-only"
                          />
                          <Icon
                            className={`mr-3 ${searchType === type.value ? "text-purple-600" : "text-gray-500"}`}
                          />
                          <span
                            className={`font-medium ${searchType === type.value ? "text-purple-600" : "text-black"}`}
                          >
                            {type.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Search Form */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-black mb-4">
                    Search Input
                  </h2>
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) =>
                          handleSearchInputChange(e.target.value)
                        }
                        placeholder={
                          searchType === "posts"
                            ? "https://instagram.com/p/..."
                            : searchType === "accounts"
                              ? "https://instagram.com/username"
                              : searchType === "hashtags"
                                ? "#fitness"
                                : "Enter keywords..."
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black"
                        required
                      />
                    </div>

                    {/* Number of Posts Input for Hashtags/Keywords */}
                    {(searchType === "hashtags" ||
                      searchType === "keywords") && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Number of Posts to Scrape (1-10)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={filterMaxPosts}
                          onChange={(e) =>
                            setFilterMaxPosts(
                              Math.min(10, Math.max(1, Number(e.target.value))),
                            )
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Higher values will take longer to scrape but return
                          more leads.
                        </p>
                      </div>
                    )}

                    {/* Account Selection for Authenticated Scraping */}
                    {(searchType === "posts" ||
                      searchType === "accounts" ||
                      searchType === "hashtags" ||
                      searchType === "keywords") && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {searchType === "accounts" || searchType === "posts"
                            ? "Select Instagram Account (Required)"
                            : "Select Instagram Account (Optional)"}
                        </label>
                        <select
                          value={selectedAccount}
                          onChange={(e) => setSelectedAccount(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black"
                          required={
                            searchType === "accounts" || searchType === "posts"
                          }
                        >
                          <option value="">
                            {searchType === "accounts" || searchType === "posts"
                              ? "Select an account..."
                              : "Use default account..."}
                          </option>
                          {accounts.map((account) => (
                            <option
                              key={account.username}
                              value={account.username}
                            >
                              @{account.username}
                            </option>
                          ))}
                        </select>
                        {accounts.length === 0 && (
                          <p className="text-sm text-gray-500 mt-1">
                            No accounts available. Please add an account first.
                          </p>
                        )}
                        {searchType !== "accounts" &&
                          searchType !== "posts" && (
                            <p className="text-sm text-gray-500 mt-1">
                              Using an authenticated account improves scraping
                              success rate.
                            </p>
                          )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <FaSpinner className="animate-spin mr-2" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <FaSearch className="mr-2" />
                          Search for Leads
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Actions - Only visible when leads are available */}
                {leads.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-black mb-4">
                      Actions
                    </h2>
                    <div className="space-y-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSelectAll}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition-colors text-sm"
                        >
                          Select All
                        </button>
                        <button
                          onClick={handleDeselectAll}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-semibold transition-colors text-sm"
                        >
                          Deselect All
                        </button>
                      </div>
                      <button
                        onClick={addSelectedToTargets}
                        disabled={selectedLeads.size === 0}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
                      >
                        <FaUserPlus className="mr-2" />
                        Add Selected to Targets ({selectedLeads.size})
                      </button>
                      <button
                        onClick={() => exportLeads("discovery", "json")}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
                      >
                        <FaDownload className="mr-2" />
                        Export Leads
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Results Section */}
              <div className="lg:col-span-2">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-black flex items-center">
                      <FaUsers className="mr-2 text-purple-600" />
                      Search Results ({leads.length})
                    </h2>
                  </div>

                  {/* Status Messages */}
                  {success && (
                    <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg mb-4">
                      {success}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg mb-4">
                      {error}
                    </div>
                  )}

                  {/* Advanced Filters section removed - now part of the search form */}

                  {/* Results Grid */}
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">
                      <FaSpinner className="animate-spin mx-auto text-4xl mb-4" />
                      <p className="text-lg">Searching for leads...</p>
                      <p className="text-sm">This may take a few moments</p>
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FaSearch className="mx-auto text-4xl mb-4" />
                      <p className="text-lg font-bold">No usernames yet!</p>
                      <p className="text-md mt-2">Ready to discover leads?</p>
                      <p className="text-sm mt-4">
                        Try copy and pasting Instagram posts, profile urls, or
                        just use hashtags or keywords to find potential
                        customers.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {leads
                        .filter((lead) => {
                          // Exclude already-contacted leads
                          const username =
                            typeof lead === "string" ? lead : lead.username;
                          if (addedLeads.has(username)) return false;

                          // Profile Pic filter
                          if (
                            filterProfilePic &&
                            typeof lead === "object" &&
                            lead.profile_pic_url === ""
                          )
                            return false;
                          if (
                            filterProfilePic &&
                            typeof lead === "object" &&
                            lead.profile_pic_url === undefined
                          )
                            return false;
                          if (filterProfilePic && typeof lead === "string")
                            return false;

                          // Bio filter
                          if (
                            filterBio &&
                            typeof lead === "object" &&
                            (!lead.biography || lead.biography.trim() === "")
                          )
                            return false;
                          if (filterBio && typeof lead === "string")
                            return false;

                          // Website filter
                          if (
                            filterWebsite &&
                            typeof lead === "object" &&
                            (!lead.external_url ||
                              lead.external_url.trim() === "")
                          )
                            return false;
                          if (filterWebsite && typeof lead === "string")
                            return false;

                          // Account type filter
                          if (
                            filterAccountType !== "both" &&
                            typeof lead === "object"
                          ) {
                            if (
                              filterAccountType === "private" &&
                              !lead.is_private
                            )
                              return false;
                            if (
                              filterAccountType === "business" &&
                              !lead.is_business_account
                            )
                              return false;
                          }
                          if (
                            filterAccountType !== "both" &&
                            typeof lead === "string"
                          )
                            return false;

                          // Followers filter
                          if (
                            typeof lead === "object" &&
                            filterFollowers.min &&
                            lead.edge_followed_by &&
                            lead.edge_followed_by.count <
                              parseInt(filterFollowers.min)
                          )
                            return false;
                          if (
                            typeof lead === "object" &&
                            filterFollowers.max &&
                            lead.edge_followed_by &&
                            lead.edge_followed_by.count >
                              parseInt(filterFollowers.max)
                          )
                            return false;

                          // Posts filter
                          if (
                            typeof lead === "object" &&
                            filterPosts.min &&
                            lead.edge_owner_to_timeline_media &&
                            lead.edge_owner_to_timeline_media.count <
                              parseInt(filterPosts.min)
                          )
                            return false;
                          if (
                            typeof lead === "object" &&
                            filterPosts.max &&
                            lead.edge_owner_to_timeline_media &&
                            lead.edge_owner_to_timeline_media.count >
                              parseInt(filterPosts.max)
                          )
                            return false;

                          return true;
                        })
                        .map((lead, index) => {
                          const username =
                            typeof lead === "string" ? lead : lead.username;
                          const leadKey = username || `lead-${index}`;
                          const isSelected = selectedLeads.has(username);
                          const isAdded = addedLeads.has(username);

                          return (
                            <div
                              key={leadKey}
                              className={`flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors ${
                                isSelected ? "ring-2 ring-purple-300" : ""
                              }`}
                            >
                              <div className="flex items-center flex-1">
                                {!isAdded && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      handleLeadSelection(username)
                                    }
                                    className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <span
                                    className={`font-medium ${isAdded ? "text-green-600" : "text-black"}`}
                                  >
                                    @{username}
                                  </span>
                                  {typeof lead === "object" && lead.comment && (
                                    <p className="text-xs text-gray-600 mt-1 truncate">
                                      {lead.comment}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {isAdded && (
                                  <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                                    Added
                                  </span>
                                )}
                                {!isAdded && (
                                  <button
                                    onClick={() => addToTargets(username)}
                                    className="px-3 py-1 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Targets Management Interface
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Status Messages */}
              {success && (
                <div className="lg:col-span-3 bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
                  {success}
                </div>
              )}

              {error && (
                <div className="lg:col-span-3 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Add Targets Section */}
              <div className="lg:col-span-1 space-y-6">
                {/* Single Target */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                    <FaUserPlus className="mr-2 text-green-600" />
                    Add Single Target
                  </h2>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newTarget}
                      onChange={(e) => handleNewTargetChange(e.target.value)}
                      placeholder="Enter username"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
                      onKeyPress={(e) =>
                        e.key === "Enter" && addTarget(newTarget)
                      }
                    />
                    <button
                      onClick={() => addTarget(newTarget)}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors"
                    >
                      <FaPlus />
                    </button>
                  </div>
                </div>

                {/* Bulk Add */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                    <FaUsers className="mr-2 text-purple-600" />
                    Bulk Add Targets
                  </h2>
                  <textarea
                    value={bulkTargets}
                    onChange={(e) => handleBulkTargetsChange(e.target.value)}
                    placeholder="Enter usernames separated by commas or new lines"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black mb-4"
                  />
                  <button
                    onClick={addBulkTargets}
                    disabled={loading || !bulkTargets.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors"
                  >
                    Add All Targets
                  </button>
                </div>

                {/* Actions */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                    <FaDownload className="mr-2 text-indigo-600" />
                    Actions
                  </h2>
                  <div className="space-y-3">
                    <button
                      onClick={copyAllTargets}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <FaCrosshairs className="mr-2" />
                      Copy All Targets
                    </button>
                    <button
                      onClick={() => exportTargets("json")}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <FaDownload className="mr-2" />
                      Export JSON
                    </button>
                    <button
                      onClick={() => exportTargets("csv")}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <FaDownload className="mr-2" />
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Targets List */}
              <div className="lg:col-span-2">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-black flex items-center">
                      <FaUsers className="mr-2 text-blue-600" />
                      Target List ({targets.length})
                    </h2>

                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={targetSearchTerm}
                          onChange={(e) => setTargetSearchTerm(e.target.value)}
                          placeholder="Search targets..."
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black"
                        />
                      </div>

                      <button
                        onClick={clearAllTargets}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                      >
                        <FaTrash className="mr-2" />
                        Clear All
                      </button>
                    </div>
                  </div>

                  {targets.filter((target) =>
                    target
                      .toLowerCase()
                      .includes(targetSearchTerm.toLowerCase()),
                  ).length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FaUsers className="mx-auto text-4xl mb-4" />
                      <p className="text-lg">No targets found</p>
                      <p className="text-sm">
                        Add some usernames to get started
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                      {targets
                        .filter((target) =>
                          target
                            .toLowerCase()
                            .includes(targetSearchTerm.toLowerCase()),
                        )
                        .map((target, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-black font-medium">
                              @{target}
                            </span>
                            <button
                              onClick={() => removeTarget(target)}
                              className="text-red-500 hover:text-red-700 p-1 transition-colors"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}{" "}
        </div>
      </div>
    </div>
  );
};

export default Leads;
