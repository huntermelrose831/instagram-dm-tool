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

  // Original Leads functionality
  const [searchType, setSearchType] = useState("posts");
  const [searchInput, setSearchInput] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addedLeads, setAddedLeads] = useState(new Set());

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
  }, [activeTab]);

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
  const fetchTargets = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/targets");
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
      const response = await fetch("http://localhost:5000/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();
      if (data.status === "success") {
        setTargets(data.targets);
        setSuccess("Target added successfully!");
        setNewTarget("");
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
      const response = await fetch(
        `http://localhost:5000/api/targets/${username}`,
        {
          method: "DELETE",
        }
      );

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

  const exportTargets = () => {
    const dataStr = JSON.stringify(targets, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "targets.json";
    link.click();
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

  const createScrapingJob = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/targeting/scraping-jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newScrapingJob),
        }
      );

      if (response.ok) {
        fetchScrapingJobs();
        setShowCreateModal(false);
        resetScrapingForm();
        setSuccess("Scraping job created successfully!");
      }
    } catch (error) {
      console.error("Error creating scraping job:", error);
      setError("Failed to create scraping job");
    } finally {
      setLoading(false);
    }
  };

  const toggleScrapingJob = async (jobId, isActive) => {
    try {
      await fetch(
        `http://localhost:5000/api/targeting/scraping-jobs/${jobId}/toggle`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
        }
      );
      fetchScrapingJobs();
    } catch (error) {
      console.error("Error toggling scraping job:", error);
    }
  };

  const resetScrapingForm = () => {
    setNewScrapingJob({
      name: "",
      type: "competitor-followers",
      targets: [],
      filters: {
        followerCount: { min: 100, max: 100000 },
        followingCount: { min: 50, max: 5000 },
        postsCount: { min: 10, max: null },
        engagementRate: { min: 1, max: null },
        location: "",
        language: "en",
        hasProfilePic: true,
        hasWebsite: false,
        isVerified: false,
      },
      maxLeads: 1000,
      isActive: false,
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setLoading(true);
    setError("");
    setLeads([]);
    setAddedLeads(new Set());

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

      const response = await fetch(`/api/scrape/${searchType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [searchType === "posts"
            ? "postUrl"
            : searchType === "accounts"
              ? "profileUrl"
              : "query"]: searchInput,
        }),
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
      // Mock data for demo
      const mockLeads = [
        "fitness_guru_2024",
        "healthy_lifestyle",
        "workout_warrior",
        "nutrition_expert",
        "gym_enthusiast",
      ];
      setLeads(mockLeads);
      setSuccess(`Found ${mockLeads.length} leads! (Demo data)`);
    } finally {
      setLoading(false);
    }
  };

  const addToTargets = async (username) => {
    try {
      const response = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        setAddedLeads((prev) => new Set([...prev, username]));
        setSuccess(`Added ${username} to targets!`);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      setError("Failed to add to targets");
    }
  };
  const addAllToTargets = async () => {
    const unadded = leads.filter((lead) => {
      const username = typeof lead === "string" ? lead : lead.username;
      return !addedLeads.has(username);
    });

    for (const lead of unadded) {
      const username = typeof lead === "string" ? lead : lead.username;
      await addToTargets(username);
    }
  };
  const exportLeads = (source = "discovery", format = "json") => {
    let dataToExport;
    let filename;

    if (source === "discovery") {
      // Export simple leads from discovery
      dataToExport = leads;
      filename = `leads_${searchType}_${Date.now()}.${format}`;
    } else {
      // Export advanced scraped leads
      dataToExport = scrapedLeads;
      filename = `scraped_leads_${Date.now()}.${format}`;
    }

    if (format === "csv" && source === "advanced") {
      // CSV export for advanced leads
      const csvHeaders = [
        "Username",
        "Full Name",
        "Followers",
        "Following",
        "Posts",
        "Engagement Rate",
        "Location",
        "Tags",
      ];
      const csvRows = dataToExport.map((lead) => [
        lead.username || "",
        lead.fullName || "",
        lead.followers || "",
        lead.following || "",
        lead.posts || "",
        lead.engagementRate || "",
        lead.location || "",
        (lead.tags || []).join(";"),
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.map((field) => `"${field}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename.replace(".json", ".csv");
      link.click();
    } else {
      // JSON export
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
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

                {/* Actions */}
                {leads.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-black mb-4">
                      Actions
                    </h2>
                    <div className="space-y-3">
                      <button
                        onClick={addAllToTargets}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
                      >
                        <FaUserPlus className="mr-2" />
                        Add All to Targets
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

                  {/* Advanced Filters UI */}
                  <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-black mb-2 flex items-center"><FaFilter className="mr-2" />Advanced Filters</h3>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={filterProfilePic} onChange={e => setFilterProfilePic(e.target.checked)} />
                        Has Profile Pic
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={filterBio} onChange={e => setFilterBio(e.target.checked)} />
                        Has Bio
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={filterWebsite} onChange={e => setFilterWebsite(e.target.checked)} />
                        Has Website
                      </label>
                      <label className="flex items-center gap-2">
                        Account Type:
                        <select value={filterAccountType} onChange={e => setFilterAccountType(e.target.value)} className="border rounded px-2 py-1">
                          <option value="both">Both</option>
                          <option value="private">Private</option>
                          <option value="business">Business</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2">
                        Followers:
                        <input type="number" placeholder="Min" className="w-16 border rounded px-1" value={filterFollowers.min} onChange={e => setFilterFollowers(f => ({...f, min: e.target.value}))} />
                        -
                        <input type="number" placeholder="Max" className="w-16 border rounded px-1" value={filterFollowers.max} onChange={e => setFilterFollowers(f => ({...f, max: e.target.value}))} />
                      </label>
                      <label className="flex items-center gap-2">
                        Posts:
                        <input type="number" placeholder="Min" className="w-16 border rounded px-1" value={filterPosts.min} onChange={e => setFilterPosts(f => ({...f, min: e.target.value}))} />
                        -
                        <input type="number" placeholder="Max" className="w-16 border rounded px-1" value={filterPosts.max} onChange={e => setFilterPosts(f => ({...f, max: e.target.value}))} />
                      </label>
                    </div>
                  </div>

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
                      <p className="text-lg">No leads found</p>
                      <p className="text-sm">
                        Try searching for Instagram posts, profiles, or hashtags
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                      {leads
                        .filter((lead) => {
                          // Exclude already-contacted leads
                          const username = typeof lead === "string" ? lead : lead.username;
                          if (addedLeads.has(username)) return false;

                          // Profile Pic filter
                          if (filterProfilePic && typeof lead === "object" && lead.profile_pic_url === "") return false;
                          if (filterProfilePic && typeof lead === "object" && lead.profile_pic_url === undefined) return false;
                          if (filterProfilePic && typeof lead === "string") return false;

                          // Bio filter
                          if (filterBio && typeof lead === "object" && (!lead.biography || lead.biography.trim() === "")) return false;
                          if (filterBio && typeof lead === "string") return false;

                          // Website filter
                          if (filterWebsite && typeof lead === "object" && (!lead.external_url || lead.external_url.trim() === "")) return false;
                          if (filterWebsite && typeof lead === "string") return false;

                          // Account type filter
                          if (filterAccountType !== "both" && typeof lead === "object") {
                            if (filterAccountType === "private" && !lead.is_private) return false;
                            if (filterAccountType === "business" && !lead.is_business_account) return false;
                          }
                          if (filterAccountType !== "both" && typeof lead === "string") return false;

                          // Followers filter
                          if (typeof lead === "object" && filterFollowers.min && lead.edge_followed_by && lead.edge_followed_by.count < parseInt(filterFollowers.min)) return false;
                          if (typeof lead === "object" && filterFollowers.max && lead.edge_followed_by && lead.edge_followed_by.count > parseInt(filterFollowers.max)) return false;

                          // Posts filter
                          if (typeof lead === "object" && filterPosts.min && lead.edge_owner_to_timeline_media && lead.edge_owner_to_timeline_media.count < parseInt(filterPosts.min)) return false;
                          if (typeof lead === "object" && filterPosts.max && lead.edge_owner_to_timeline_media && lead.edge_owner_to_timeline_media.count > parseInt(filterPosts.max)) return false;

                          return true;
                        })
                        .map((lead, index) => {
                          const username = typeof lead === "string" ? lead : lead.username;
                          const leadKey = username || `lead-${index}`;
                          return (
                            <div
                              key={leadKey}
                              className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1">
                                <span className="text-black font-medium">
                                  @{username}
                                </span>
                                {typeof lead === "object" && lead.comment && (
                                  <p className="text-xs text-gray-600 mt-1 truncate">
                                    {lead.comment}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => addToTargets(username)}
                                disabled={addedLeads.has(username)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                  addedLeads.has(username)
                                    ? "bg-green-100 text-green-600 cursor-not-allowed"
                                    : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                                }`}
                              >
                                {addedLeads.has(username) ? "Added" : "Add"}
                              </button>
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
                      onClick={exportTargets}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <FaDownload className="mr-2" />
                      Export JSON
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
                      Target List (
                      {
                        targets.filter((target) =>
                          target
                            .toLowerCase()
                            .includes(targetSearchTerm.toLowerCase())
                        ).length
                      }
                      )
                    </h2>

                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={targetSearchTerm}
                          onChange={(e) =>
                            handleTargetSearchTermChange(e.target.value)
                          }
                          placeholder="Search targets..."
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-black"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Targets Grid */}
                  {targets.filter((target) =>
                    target
                      .toLowerCase()
                      .includes(targetSearchTerm.toLowerCase())
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
                            .includes(targetSearchTerm.toLowerCase())
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
