import React, { useState, useEffect } from "react";
import {
  FaUsers,
  FaPlus,
  FaTrash,
  FaDownload,
  FaUpload,
  FaUserPlus,
  FaSearch,
  FaFilter,
} from "react-icons/fa";

const Targets = () => {
  const [usernames, setUsernames] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [bulkUsernames, setBulkUsernames] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await fetch("/api/targets");
      const data = await response.json();
      setUsernames(data.targets || []);
    } catch (error) {
      console.error("Error fetching targets:", error);
    }
  };

  const addUsername = async (username) => {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();
      if (data.status === "success") {
        setUsernames(data.targets);
        setSuccess("Username added successfully!");
        setNewUsername("");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to add username");
      }
    } catch (error) {
      setError("Network error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addBulkUsernames = async () => {
    if (!bulkUsernames.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const usernameList = bulkUsernames
      .split(/[,\n]/)
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      for (const username of usernameList) {
        await addUsername(username);
      }
      setBulkUsernames("");
      setSuccess(`Added ${usernameList.length} usernames successfully!`);
    } catch (error) {
      setError("Error adding bulk usernames");
    } finally {
      setLoading(false);
    }
  };

  const removeUsername = async (username) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/targets/${username}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.status === "success") {
        setUsernames(data.targets);
        setSuccess("Username removed successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      setError("Failed to remove username");
    } finally {
      setLoading(false);
    }
  };

  const exportTargets = () => {
    const dataStr = JSON.stringify(usernames, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "targets.json";
    link.click();
  };

  const filteredUsernames = usernames.filter((username) =>
    username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-black flex items-center">
            <FaUsers className="mr-3 text-blue-600" />
            Target Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your target audience lists for DM campaigns
          </p>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add Targets Section */}
            <div className="lg:col-span-1 space-y-6">
              {/* Single Username */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                  <FaUserPlus className="mr-2 text-green-600" />
                  Add Single Target
                </h2>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
                    onKeyPress={(e) =>
                      e.key === "Enter" && addUsername(newUsername)
                    }
                  />
                  <button
                    onClick={() => addUsername(newUsername)}
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
                  <FaUpload className="mr-2 text-purple-600" />
                  Bulk Add Targets
                </h2>
                <textarea
                  value={bulkUsernames}
                  onChange={(e) => setBulkUsernames(e.target.value)}
                  placeholder="Enter usernames separated by commas or new lines"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black mb-4"
                />
                <button
                  onClick={addBulkUsernames}
                  disabled={loading || !bulkUsernames.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors"
                >
                  Add All Targets
                </button>
              </div>

              {/* Export */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                  <FaDownload className="mr-2 text-indigo-600" />
                  Export Targets
                </h2>
                <button
                  onClick={exportTargets}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
                >
                  <FaDownload className="mr-2" />
                  Download JSON
                </button>
              </div>
            </div>

            {/* Targets List */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-black flex items-center">
                    <FaUsers className="mr-2 text-blue-600" />
                    Target List ({filteredUsernames.length})
                  </h2>

                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search targets..."
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-black"
                      />
                    </div>
                  </div>
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

                {/* Targets Grid */}
                {filteredUsernames.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FaUsers className="mx-auto text-4xl mb-4" />
                    <p className="text-lg">No targets found</p>
                    <p className="text-sm">Add some usernames to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {filteredUsernames.map((username, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-black font-medium">
                          @{username}
                        </span>
                        <button
                          onClick={() => removeUsername(username)}
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
        </div>
      </div>
    </div>
  );
};

export default Targets;
