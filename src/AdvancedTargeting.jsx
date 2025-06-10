import React, { useState, useEffect } from "react";
import {
  FaSearch,
  FaHashtag,
  FaUsers,
  FaMapMarkerAlt,
  FaFilter,
  FaDownload,
  FaPlay,
  FaPause,
  FaStop,
  FaCog,
  FaChartLine,
  FaEye,
  FaHeart,
  FaComment,
  FaUserPlus,
  FaRocket,
  FaSave,
  FaPlus,
  FaTrash,
} from "react-icons/fa";

const AdvancedTargeting = () => {
  const [activeTab, setActiveTab] = useState("scraping");
  const [scrapingJobs, setScrapingJobs] = useState([]);
  const [targetingRules, setTargetingRules] = useState([]);
  const [scrapedLeads, setScrapedLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
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

  const [filterConfig, setFilterConfig] = useState({
    keywords: [],
    hashtags: [],
    competitors: [],
    locations: [],
    demographics: {
      ageRange: [18, 65],
      interests: [],
      languages: ["en"],
    },
    engagement: {
      minFollowers: 100,
      maxFollowers: 100000,
      minEngagementRate: 1,
    },
  });

  useEffect(() => {
    fetchScrapingJobs();
    fetchTargetingRules();
    fetchScrapedLeads();
  }, []);

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
    setIsLoading(true);
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
        resetForm();
      }
    } catch (error) {
      console.error("Error creating scraping job:", error);
    } finally {
      setIsLoading(false);
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

  const exportLeads = async (format = "csv") => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/targeting/leads/export?format=${format}`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads.${format}`;
        a.click();
      }
    } catch (error) {
      console.error("Error exporting leads:", error);
    }
  };

  const resetForm = () => {
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

  const ScrapingJobCard = ({ job }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">{job.name}</h3>
          <p className="text-sm text-gray-600 capitalize">
            {job.type.replace("-", " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              job.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {job.isActive ? "Running" : "Stopped"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Leads Found</p>
          <p className="text-lg font-semibold">{job.leadsFound || 0}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Target</p>
          <p className="text-lg font-semibold">{job.maxLeads}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Success Rate</p>
          <p className="text-lg font-semibold">{job.successRate || 0}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Last Run</p>
          <p className="text-sm">
            {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : "Never"}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Targets:</p>
        <div className="flex flex-wrap gap-1">
          {job.targets?.slice(0, 3).map((target, index) => (
            <span
              key={index}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
            >
              {target}
            </span>
          ))}
          {job.targets?.length > 3 && (
            <span className="text-xs text-gray-500">
              +{job.targets.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleScrapingJob(job.id, job.isActive)}
            className={`p-2 rounded-lg ${
              job.isActive
                ? "text-red-600 hover:bg-red-50"
                : "text-green-600 hover:bg-green-50"
            }`}
            title={job.isActive ? "Stop" : "Start"}
          >
            {job.isActive ? <FaStop /> : <FaPlay />}
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <FaCog title="Settings" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
            <FaEye title="View Results" />
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <FaDownload title="Export" />
          </button>
        </div>
      </div>
    </div>
  );

  const LeadCard = ({ lead }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {lead.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">@{lead.username}</h4>
            <p className="text-sm text-gray-600">{lead.fullName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 text-gray-500 hover:text-blue-600">
            <FaUserPlus title="Add to Campaign" />
          </button>
          <button className="p-1 text-gray-500 hover:text-green-600">
            <FaSave title="Save Lead" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <p className="text-sm font-semibold">
            {lead.followers?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-gray-600">Followers</p>
        </div>
        <div>
          <p className="text-sm font-semibold">
            {lead.following?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-gray-600">Following</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{lead.posts || 0}</p>
          <p className="text-xs text-gray-600">Posts</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Engagement: {lead.engagementRate || 0}%
        </span>
        <div className="flex items-center gap-1">
          {lead.tags?.map((tag, index) => (
            <span
              key={index}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const CreateScrapingJobModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Create Scraping Job
          </h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Name
              </label>
              <input
                type="text"
                value={newScrapingJob.name}
                onChange={(e) =>
                  setNewScrapingJob({ ...newScrapingJob, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Competitor Followers - Fashion Brands"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scraping Type
              </label>
              <select
                value={newScrapingJob.type}
                onChange={(e) =>
                  setNewScrapingJob({ ...newScrapingJob, type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="competitor-followers">
                  Competitor Followers
                </option>
                <option value="hashtag-users">Hashtag Users</option>
                <option value="location-users">Location-based Users</option>
                <option value="post-engagers">Post Engagers</option>
                <option value="story-viewers">Story Viewers</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Leads
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="100"
                max="10000"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Followers
                </label>
                <input
                  type="number"
                  value={newScrapingJob.filters.followerCount.min}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      filters: {
                        ...newScrapingJob.filters,
                        followerCount: {
                          ...newScrapingJob.filters.followerCount,
                          min: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Followers
                </label>
                <input
                  type="number"
                  value={newScrapingJob.filters.followerCount.max}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      filters: {
                        ...newScrapingJob.filters,
                        followerCount: {
                          ...newScrapingJob.filters.followerCount,
                          max: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={newScrapingJob.filters.location}
                onChange={(e) =>
                  setNewScrapingJob({
                    ...newScrapingJob,
                    filters: {
                      ...newScrapingJob.filters,
                      location: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="New York, NY"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newScrapingJob.filters.hasProfilePic}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      filters: {
                        ...newScrapingJob.filters,
                        hasProfilePic: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm">Has Profile Picture</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newScrapingJob.filters.hasWebsite}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      filters: {
                        ...newScrapingJob.filters,
                        hasWebsite: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm">Has Website Link</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newScrapingJob.filters.isVerified}
                  onChange={(e) =>
                    setNewScrapingJob({
                      ...newScrapingJob,
                      filters: {
                        ...newScrapingJob.filters,
                        isVerified: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm">Verified Accounts Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={createScrapingJob}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FaRocket />
            {isLoading ? "Creating..." : "Create Job"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Advanced Targeting & Scraping
            </h1>
            <p className="text-gray-600">
              Find and target your ideal audience with precision
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => exportLeads("csv")}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FaDownload />
              Export Leads
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaPlus />
              New Scraping Job
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Active Jobs",
              value: scrapingJobs.filter((j) => j.isActive).length,
              icon: FaRocket,
              color: "text-blue-600",
              bgColor: "bg-blue-50",
            },
            {
              title: "Total Leads",
              value: scrapedLeads.length.toLocaleString(),
              icon: FaUsers,
              color: "text-green-600",
              bgColor: "bg-green-50",
            },
            {
              title: "Success Rate",
              value: "94%",
              icon: FaChartLine,
              color: "text-purple-600",
              bgColor: "bg-purple-50",
            },
            {
              title: "Quality Score",
              value: "8.7/10",
              icon: FaHeart,
              color: "text-orange-600",
              bgColor: "bg-orange-50",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`text-xl ${stat.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "scraping", label: "Scraping Jobs", icon: FaRocket },
                { id: "leads", label: "Scraped Leads", icon: FaUsers },
                { id: "targeting", label: "Targeting Rules", icon: FaFilter },
                { id: "analytics", label: "Analytics", icon: FaChartLine },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.icon />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === "scraping" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Scraping Jobs
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {scrapingJobs.map((job) => (
                  <ScrapingJobCard key={job.id} job={job} />
                ))}
                {scrapingJobs.length === 0 && (
                  <div className="col-span-3 text-center py-12">
                    <FaRocket className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No scraping jobs yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Create your first scraping job to start finding leads
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Scraping Job
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "leads" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Scraped Leads ({scrapedLeads.length})
                </h2>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search leads..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button className="p-2 text-gray-600 hover:text-gray-800">
                    <FaSearch />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {scrapedLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Scraping Job Modal */}
      {showCreateModal && <CreateScrapingJobModal />}
    </div>
  );
};

export default AdvancedTargeting;
