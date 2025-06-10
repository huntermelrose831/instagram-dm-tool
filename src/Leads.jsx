import React, { useState, useEffect } from "react";
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
  FaPlay,
  FaPause,
  FaStop,
  FaCog,
  FaChartLine,
  FaEye,
  FaHeart,
  FaComment,
  FaRocket,
  FaSave,
  FaTrash,
  FaCrosshairs,
} from "react-icons/fa";

const Leads = () => {
  // Main tab state
  const [activeTab, setActiveTab] = useState("discovery");

  // Original Leads functionality
  const [searchType, setSearchType] = useState("posts");
  const [searchInput, setSearchInput] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addedLeads, setAddedLeads] = useState(new Set());

  // Advanced Targeting functionality
  const [scrapingJobs, setScrapingJobs] = useState([]);
  const [targetingRules, setTargetingRules] = useState([]);
  const [scrapedLeads, setScrapedLeads] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Form states for advanced targeting
  const [newScrapingJob, setNewScrapingJob] = useState({
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
  const searchTypes = [
    { value: "posts", label: "Instagram Posts", icon: FaInstagram },
    { value: "accounts", label: "Profile Followers", icon: FaUsers },
    { value: "hashtags", label: "Hashtag Search", icon: FaHashtag },
    { value: "keywords", label: "Keyword Search", icon: FaSearch },
  ];

  // Initialize data on component mount
  useEffect(() => {
    if (activeTab === "advanced") {
      fetchScrapingJobs();
      fetchTargetingRules();
      fetchScrapedLeads();
    }
  }, [activeTab]);

  // Advanced targeting API functions
  const fetchScrapingJobs = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/targeting/scraping-jobs"
      );
      if (response.ok) {
        const data = await response.json();
        setScrapingJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching scraping jobs:", error);
    }
  };

  const fetchTargetingRules = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/targeting/rules");
      if (response.ok) {
        const data = await response.json();
        setTargetingRules(data.rules || []);
      }
    } catch (error) {
      console.error("Error fetching targeting rules:", error);
    }
  };

  const fetchScrapedLeads = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/targeting/leads");
      if (response.ok) {
        const data = await response.json();
        setScrapedLeads(data.leads || []);
      }
    } catch (error) {
      console.error("Error fetching scraped leads:", error);
    }
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
        setLeads(data.leads || data.usernames || []);
        setSuccess(
          `Found ${data.leads?.length || data.usernames?.length || 0} leads!`
        );
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
    const unadded = leads.filter((lead) => !addedLeads.has(lead));
    for (const lead of unadded) {
      await addToTargets(lead);
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
              Advanced Targeting
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
                            onChange={(e) => setSearchType(e.target.value)}
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
                        onChange={(e) => setSearchInput(e.target.value)}
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
                      {leads.map((lead, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-black font-medium">
                            @{lead}
                          </span>
                          <button
                            onClick={() => addToTargets(lead)}
                            disabled={addedLeads.has(lead)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              addedLeads.has(lead)
                                ? "bg-green-100 text-green-600 cursor-not-allowed"
                                : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                            }`}
                          >
                            {addedLeads.has(lead) ? "Added" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Advanced Targeting Interface
            <div className="space-y-6">
              {/* Status Messages */}
              {success && (
                <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
                  {success}
                </div>
              )}

              {error && (
                <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FaPlus />
                    Create Scraping Job
                  </button>

                  <button
                    onClick={() => exportLeads("advanced", "csv")}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FaDownload />
                    Export Leads
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  {scrapedLeads.length} scraped leads •{" "}
                  {scrapingJobs.filter((j) => j.isActive).length} active jobs
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Scraping Jobs */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <FaRocket className="mr-2 text-blue-600" />
                    Scraping Jobs ({scrapingJobs.length})
                  </h2>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {scrapingJobs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FaRocket className="mx-auto text-3xl mb-3" />
                        <p>No scraping jobs yet</p>
                        <p className="text-sm">
                          Create your first job to start collecting leads
                          automatically
                        </p>
                      </div>
                    ) : (
                      scrapingJobs.map((job) => (
                        <div
                          key={job.id}
                          className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-gray-900 mb-1">
                                {job.name}
                              </h3>
                              <p className="text-sm text-gray-600 capitalize">
                                {job.type.replace("-", " ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  toggleScrapingJob(job.id, job.isActive)
                                }
                                className={`p-2 rounded-lg transition-colors ${
                                  job.isActive
                                    ? "bg-green-100 text-green-600 hover:bg-green-200"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                {job.isActive ? <FaPause /> : <FaPlay />}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Progress:</span>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{
                                      width: `${(job.leadsFound / job.maxLeads) * 100}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-xs">
                                  {job.leadsFound}/{job.maxLeads}
                                </span>
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Success Rate:
                              </span>
                              <span className="font-medium text-green-600 ml-1">
                                {job.successRate}%
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-gray-500">
                            Last run:{" "}
                            {new Date(job.lastRun).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Scraped Leads */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <FaUsers className="mr-2 text-purple-600" />
                    Scraped Leads ({scrapedLeads.length})
                  </h2>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {scrapedLeads.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FaUsers className="mx-auto text-3xl mb-3" />
                        <p>No leads found yet</p>
                        <p className="text-sm">
                          Start a scraping job to collect leads
                        </p>
                      </div>
                    ) : (
                      scrapedLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-gray-900">
                                  @{lead.username}
                                </h3>
                                {lead.isVerified && (
                                  <span className="text-blue-500 text-xs">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {lead.fullName}
                              </p>

                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                <div>
                                  👥 {lead.followers?.toLocaleString()}{" "}
                                  followers
                                </div>
                                <div>📍 {lead.location}</div>
                                <div>📊 {lead.engagementRate}% engagement</div>
                                <div>📝 {lead.posts} posts</div>
                              </div>

                              {lead.tags && lead.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {lead.tags.map((tag, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => addToTargets(lead.username)}
                              disabled={addedLeads.has(lead.username)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                addedLeads.has(lead.username)
                                  ? "bg-green-100 text-green-600 cursor-not-allowed"
                                  : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                              }`}
                            >
                              {addedLeads.has(lead.username) ? "Added" : "Add"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Scraping Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Scraping Job</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Name
                </label>
                <input
                  type="text"
                  value={newScrapingJob.name}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter job name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scraping Type
                </label>
                <select
                  value={newScrapingJob.type}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      type: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="competitor-followers">
                    Competitor Followers
                  </option>
                  <option value="hashtag-users">Hashtag Users</option>
                  <option value="post-engagers">Post Engagers</option>
                  <option value="location-based">Location Based</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Leads
                </label>
                <input
                  type="number"
                  value={newScrapingJob.maxLeads}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      maxLeads: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  min="100"
                  max="10000"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={createScrapingJob}
                  disabled={loading || !newScrapingJob.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? "Creating..." : "Create Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
