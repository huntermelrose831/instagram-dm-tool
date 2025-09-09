import {
  FaInstagram,
  FaPlus,
  FaTrash,
  FaEdit,
  FaCheckCircle,
  FaTimesCircle,
  FaCog,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaExchangeAlt,
  FaGlobe,
  FaClock,
  FaExclamationTriangle,
  FaBan,
  FaPlay,
  FaPause,
  FaChartLine,
  FaRobot,
  FaUserShield,
  FaServer,
} from "react-icons/fa";
import React, { useState, useEffect, useCallback } from "react";

const Accounts = () => {
  // Main tab state
  const [activeTab, setActiveTab] = useState("accounts");

  // Original accounts functionality
  const [accounts, setAccounts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAccount, setNewAccount] = useState({
    username: "",
    password: "",
    proxy: "",
    dailyLimit: 50,
    notes: "",
  });
  const [editingAccount, setEditingAccount] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Safety monitoring data
  const [safetyAccounts, setSafetyAccounts] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [rateLimits, setRateLimits] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editingRateLimit, setEditingRateLimit] = useState(null);

  // Form states for safety features
  const [newProxy, setNewProxy] = useState({
    host: "",
    port: "",
    username: "",
    password: "",
    type: "http",
  });

  const [newRateLimit, setNewRateLimit] = useState({
    accountId: "",
    dmPerHour: 10,
    dmPerDay: 100,
    followPerHour: 20,
    followPerDay: 200,
    isActive: true,
  });

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

  useEffect(() => {
    fetchAccounts();
    if (
      activeTab === "safety" ||
      activeTab === "proxies" ||
      activeTab === "limits"
    ) {
      fetchSafetyAccounts();
      fetchProxies();
      fetchRateLimits();
    }
  }, [activeTab]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/accounts`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(Array.isArray(data) ? data : data.accounts || []);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSafetyAccounts = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/accounts`
      );
      if (response.ok) {
        const data = await response.json();
        setSafetyAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error fetching safety accounts:", error);
    }
  };
  const handleNewAccountChange = (field, value) => {
    setNewAccount((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const fetchProxies = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/proxies`
      );
      if (response.ok) {
        const data = await response.json();
        setProxies(data.proxies || []);
      }
    } catch (error) {
      console.error("Error fetching proxies:", error);
    }
  };

  const fetchRateLimits = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/rate-limits`
      );
      if (response.ok) {
        const data = await response.json();
        setRateLimits(data.rateLimits || []);
      }
    } catch (error) {
      console.error("Error fetching rate limits:", error);
    }
  };

  const addProxy = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/proxies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":
              "86b3296b98b31fb349420dd90838470d06b0bc3b4cf2c9ec41118316cba1756d",
          },
          body: JSON.stringify(newProxy),
        }
      );

      if (response.ok) {
        fetchProxies();
        setShowAddModal(false);
        setNewProxy({
          host: "",
          port: "",
          username: "",
          password: "",
          type: "http",
        });
      }
    } catch (error) {
      console.error("Error adding proxy:", error);
    }
  };

  const addRateLimit = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/rate-limits`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":
              "86b3296b98b31fb349420dd90838470d06b0bc3b4cf2c9ec41118316cba1756d",
          },
          body: JSON.stringify(newRateLimit),
        }
      );

      if (response.ok) {
        fetchRateLimits();
        setShowAddModal(false);
        setNewRateLimit({
          accountId: "",
          dmPerHour: 10,
          dmPerDay: 100,
          followPerHour: 20,
          followPerDay: 200,
          isActive: true,
        });
      }
    } catch (error) {
      console.error("Error adding rate limit:", error);
    }
  };

  // Delete a proxy by ID
  const deleteProxy = async (proxyId) => {
    if (!window.confirm("Are you sure you want to delete this proxy?")) {
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/proxies/${proxyId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        fetchProxies();
      }
    } catch (error) {
      console.error("Error deleting proxy:", error);
    }
  };

  const performHealthCheck = async (accountId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/account-safety/health-check/${accountId}`
      );
      if (response.ok) {
        const data = await response.json();
        // You can handle the health check results here
        console.log("Health check results:", data.healthCheck);
      }
    } catch (error) {
      console.error("Error performing health check:", error);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      // Step 1: Add the account to database
      const response = await fetch(`${API_BASE_URL}/api/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key":
            "86b3296b98b31fb349420dd90838470d06b0bc3b4cf2c9ec41118316cba1756d",
        },
        body: JSON.stringify(newAccount),
      });

      if (response.ok) {
        const createdAccount = await response.json();
        setAccounts([...accounts, createdAccount]);

        // Step 2: Automatically login to Instagram and save cookies
        try {
          const loginResponse = await fetch(
            `${API_BASE_URL}/api/accounts/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key":
                  "86b3296b98b31fb349420dd90838470d06b0bc3b4cf2c9ec41118316cba1756d",
              },
              body: JSON.stringify({
                username: newAccount.username,
                password: newAccount.password,
              }),
            }
          );

          const loginResult = await loginResponse.json();

          if (loginResponse.ok) {
            alert(
              "✅ Account added successfully and logged in to Instagram! Ready to send DMs."
            );
          } else {
            alert(
              `✅ Account added successfully, but Instagram login failed: ${loginResult.message}\nYou can try logging in again later.`
            );
          }
        } catch (loginError) {
          console.error("Error during Instagram login:", loginError);
          alert(
            "✅ Account added successfully, but Instagram login failed. You can try logging in again later."
          );
        }

        // Reset form and close
        setNewAccount({
          username: "",
          password: "",
          proxy: "",
          dailyLimit: 50,
          notes: "",
        });
        setShowAddForm(false);
      } else {
        alert("Failed to add account. Please try again.");
      }
    } catch (error) {
      console.error("Error adding account:", error);
      alert("Failed to add account. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm("Are you sure you want to delete this account?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/accounts/id/${accountId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":
              "86b3296b98b31fb349420dd90838470d06b0bc3b4cf2c9ec41118316cba1756d",
          },
        }
      );

      if (response.ok) {
        setAccounts(accounts.filter((account) => account.id !== accountId));
        console.log("Account deleted successfully");
      } else {
        const errorData = await response.json();
        console.error("Error deleting account:", errorData.message);
        alert("Failed to delete account: " + errorData.message);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Error deleting account: " + error.message);
    }
  };

  const handleUpdateAccount = async (accountId, updates) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/accounts/${accountId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":
              "86b3296b98b31fb349420dd90838470d06b0bc3b4cf2c9ec41118316cba1756d",
          },
          body: JSON.stringify(updates),
        }
      );

      if (response.ok) {
        const updatedAccount = await response.json();
        setAccounts(
          accounts.map((account) =>
            account.id === accountId ? updatedAccount : account
          )
        );
        setEditingAccount(null);
      }
    } catch (error) {
      console.error("Error updating account:", error);
    }
  };

  const togglePasswordVisibility = (accountId) => {
    setShowPasswords((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "text-green-600";
      case "suspended":
        return "text-red-600";
      case "limited":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return <FaCheckCircle className="text-green-600" />;
      case "suspended":
        return <FaTimesCircle className="text-red-600" />;
      case "limited":
        return <FaTimesCircle className="text-yellow-600" />;
      default:
        return <FaTimesCircle className="text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black flex items-center gap-3">
                <FaInstagram className="text-green-600" />
                Account Management & Safety
              </h1>
              <p className="text-gray-600 mt-2">
                Manage your Instagram accounts, monitor safety, and configure
                protection settings
              </p>
            </div>
            <button
              onClick={() => {
                if (activeTab === "accounts") {
                  setShowAddForm(!showAddForm);
                } else if (activeTab === "proxies") {
                  setShowAddModal(true);
                } else if (activeTab === "limits") {
                  setShowAddModal(true);
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <FaPlus className="text-sm" />
              {activeTab === "accounts"
                ? "Add Account"
                : activeTab === "proxies"
                  ? "Add Proxy"
                  : activeTab === "limits"
                    ? "Add Rate Limit"
                    : "Add"}
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-6">
            <button
              onClick={() => setActiveTab("accounts")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "accounts"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FaInstagram className="inline mr-2" />
              Accounts
            </button>
            <button
              onClick={() => setActiveTab("safety")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "safety"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FaShieldAlt className="inline mr-2" />
              Safety Monitor
            </button>
            <button
              onClick={() => setActiveTab("proxies")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "proxies"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FaServer className="inline mr-2" />
              Proxies
            </button>
            <button
              onClick={() => setActiveTab("limits")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "limits"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FaClock className="inline mr-2" />
              Rate Limits
            </button>
          </div>
        </div>

        {activeTab === "accounts" ? (
          // Original Account Management Interface
          <div>
            {/* ...existing code... */}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Accounts
                    </p>
                    <p className="text-2xl font-bold text-black">
                      {accounts.length}
                    </p>
                  </div>
                  <FaInstagram className="text-3xl text-green-600" />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-green-600">
                      {accounts.filter((acc) => acc.status === "active").length}
                    </p>
                  </div>
                  <FaCheckCircle className="text-3xl text-green-600" />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Suspended
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {
                        accounts.filter((acc) => acc.status === "suspended")
                          .length
                      }
                    </p>
                  </div>
                  <FaTimesCircle className="text-3xl text-red-600" />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Limited</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {
                        accounts.filter((acc) => acc.status === "limited")
                          .length
                      }
                    </p>
                  </div>
                  <FaTimesCircle className="text-3xl text-yellow-600" />
                </div>
              </div>
            </div>

            {/* Add Account Form */}
            {showAddForm && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
                <h2 className="text-xl font-semibold text-black mb-4">
                  Add New Account
                </h2>
                <form
                  onSubmit={handleAddAccount}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={newAccount.username}
                      onChange={(e) =>
                        handleNewAccountChange("username", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="@username"
                      required
                      key="username-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newAccount.password}
                      onChange={(e) =>
                        handleNewAccountChange("password", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="Password"
                      required
                      key="password-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Proxy (Optional)
                    </label>
                    <input
                      type="text"
                      value={newAccount.proxy}
                      onChange={(e) =>
                        handleNewAccountChange("proxy", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="proxy:port"
                      key="proxy-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Daily Limit
                    </label>
                    <input
                      type="number"
                      value={newAccount.dailyLimit}
                      onChange={(e) =>
                        handleNewAccountChange(
                          "dailyLimit",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      min="1"
                      max="100"
                      key="daily-limit-input"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={newAccount.notes}
                      onChange={(e) =>
                        handleNewAccountChange("notes", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      rows="3"
                      placeholder="Additional notes about this account..."
                      key="notes-textarea"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-4">
                    <button
                      type="submit"
                      disabled={
                        isLoggingIn ||
                        !newAccount.username ||
                        !newAccount.password
                      }
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {isLoggingIn ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Adding & Logging in...
                        </>
                      ) : (
                        <>
                          <FaInstagram />
                          Add Account & Login to Instagram
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      disabled={isLoggingIn}
                      className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Accounts Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-black">
                  Account List
                </h2>
              </div>

              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <FaInstagram className="text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No accounts added
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Get started by adding your first Instagram account
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                  >
                    <FaPlus className="text-sm" />
                    Add Your First Account
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Account
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Daily Limit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Messages Sent Today
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {accounts.map((account) => (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <FaInstagram className="text-2xl text-green-600 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-black">
                                  {account.username}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {account.proxy
                                    ? `Proxy: ${account.proxy}`
                                    : "No proxy"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(account.status)}
                              <span
                                className={`text-sm font-medium capitalize ${getStatusColor(account.status)}`}
                              >
                                {account.status || "active"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                            {account.dailyLimit || 50}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                            {account.messagesSentToday || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {account.lastActivity
                              ? new Date(
                                  account.lastActivity
                                ).toLocaleDateString()
                              : "Never"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingAccount(account)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                title="Edit Account"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() =>
                                  togglePasswordVisibility(account.id)
                                }
                                className="text-gray-600 hover:text-gray-800 transition-colors"
                                title="Toggle Password Visibility"
                              >
                                {showPasswords[account.id] ? (
                                  <FaEyeSlash />
                                ) : (
                                  <FaEye />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteAccount(account.id)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Delete Account"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Edit Modal */}
            {editingAccount && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-semibold text-black mb-4">
                    Edit Account
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateAccount(editingAccount.id, editingAccount);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={editingAccount.username}
                        onChange={(e) =>
                          setEditingAccount({
                            ...editingAccount,
                            username: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Daily Limit
                      </label>
                      <input
                        type="number"
                        value={editingAccount.dailyLimit}
                        onChange={(e) =>
                          setEditingAccount({
                            ...editingAccount,
                            dailyLimit: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        min="1"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={editingAccount.status || "active"}
                        onChange={(e) =>
                          setEditingAccount({
                            ...editingAccount,
                            status: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="active">Active</option>
                        <option value="limited">Limited</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAccount(null)}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>{" "}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "safety" ? (
          // Safety Monitoring Interface
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Healthy Accounts
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {
                        safetyAccounts.filter((acc) => acc.status === "healthy")
                          .length
                      }
                    </p>
                  </div>
                  <FaCheckCircle className="text-3xl text-green-600" />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Warning Accounts
                    </p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {
                        safetyAccounts.filter((acc) => acc.status === "warning")
                          .length
                      }
                    </p>
                  </div>
                  <FaExclamationTriangle className="text-3xl text-yellow-600" />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Restricted Accounts
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {
                        safetyAccounts.filter(
                          (acc) => acc.status === "restricted"
                        ).length
                      }
                    </p>
                  </div>
                  <FaBan className="text-3xl text-red-600" />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Active Proxies
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {proxies.filter((proxy) => proxy.isActive).length}
                    </p>
                  </div>
                  <FaGlobe className="text-3xl text-blue-600" />
                </div>
              </div>
            </div>

            {/* Account Safety Grid */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Account Safety Monitor
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Daily Usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proxy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {safetyAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FaInstagram className="text-pink-500 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                @{account.username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {account.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              account.status === "healthy"
                                ? "bg-green-100 text-green-800"
                                : account.status === "warning"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {account.status === "healthy" && (
                              <FaCheckCircle className="mr-1" />
                            )}
                            {account.status === "warning" && (
                              <FaExclamationTriangle className="mr-1" />
                            )}
                            {account.status === "restricted" && (
                              <FaBan className="mr-1" />
                            )}
                            {account.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div>
                              DMs: {account.dmsToday}/{account.dailyDmLimit}
                            </div>
                            <div>
                              Follows: {account.followsToday}/
                              {account.dailyFollowLimit}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                account.riskScore <= 3
                                  ? "bg-green-100 text-green-800"
                                  : account.riskScore <= 6
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {account.riskScore}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {account.proxyId ? (
                            <span className="text-green-600">Connected</span>
                          ) : (
                            <span className="text-red-600">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => performHealthCheck(account.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Health Check"
                            >
                              <FaChartLine />
                            </button>
                            <button
                              onClick={() =>
                                toggleAccountRotation(
                                  account.id,
                                  !account.rotationEnabled
                                )
                              }
                              className={`${account.rotationEnabled ? "text-green-600" : "text-gray-400"} hover:text-green-900`}
                              title="Toggle Rotation"
                            >
                              <FaExchangeAlt />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === "proxies" ? (
          // Proxies Management Interface
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Proxy Management
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {proxies.map((proxy) => (
                  <div
                    key={proxy.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">
                        {proxy.host}:{proxy.port}
                      </h3>
                      <span
                        className={`w-3 h-3 rounded-full ${
                          proxy.isActive ? "bg-green-400" : "bg-red-400"
                        }`}
                      ></span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div>Type: {proxy.type.toUpperCase()}</div>
                      <div>Location: {proxy.location}</div>
                      <div>Connected: {proxy.connectedAccounts} accounts</div>
                      <div>Response: {proxy.responseTime}ms</div>
                      <div>Success Rate: {proxy.successRate}%</div>
                    </div>

                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => deleteProxy(proxy.id)}
                        className="text-red-600 hover:text-red-900 flex items-center"
                        title="Delete Proxy"
                      >
                        <FaTrash className="mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Rate Limits Interface
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Rate Limit Configuration
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        DM Limits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Follow Limits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rateLimits.map((limit) => (
                      <tr key={limit.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            @{limit.accountUsername}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {limit.dmPerHour}/hr • {limit.dmPerDay}/day
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {limit.followPerHour}/hr • {limit.followPerDay}/day
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              limit.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {limit.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingRateLimit(limit)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit Rate Limit"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => deleteRateLimit(limit.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Rate Limit"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add Proxy Modal */}
        {showAddModal && activeTab === "proxies" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add New Proxy</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Host
                  </label>
                  <input
                    type="text"
                    value={newProxy.host}
                    onChange={(e) =>
                      setNewProxy({ ...newProxy, host: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="proxy.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={newProxy.port}
                    onChange={(e) =>
                      setNewProxy({ ...newProxy, port: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="8080"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newProxy.type}
                    onChange={(e) =>
                      setNewProxy({ ...newProxy, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="http">HTTP</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>

                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => deleteProxy(proxy.id)}
                    className="text-red-600 hover:text-red-900 flex items-center"
                    title="Delete Proxy"
                  >
                    <FaTrash className="mr-1" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Rate Limit Modal */}
        {showAddModal && activeTab === "limits" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add New Rate Limit</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account
                  </label>
                  <select
                    value={newRateLimit.accountId}
                    onChange={(e) =>
                      handleNewRateLimitChange("accountId", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select an account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DMs per Hour
                    </label>
                    <input
                      type="number"
                      value={newRateLimit.dmPerHour}
                      onChange={(e) =>
                        handleNewRateLimitChange(
                          "dmPerHour",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DMs per Day
                    </label>
                    <input
                      type="number"
                      value={newRateLimit.dmPerDay}
                      onChange={(e) =>
                        handleNewRateLimitChange(
                          "dmPerDay",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Follows per Hour
                    </label>
                    <input
                      type="number"
                      value={newRateLimit.followPerHour}
                      onChange={(e) =>
                        handleNewRateLimitChange(
                          "followPerHour",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Follows per Day
                    </label>
                    <input
                      type="number"
                      value={newRateLimit.followPerDay}
                      onChange={(e) =>
                        handleNewRateLimitChange(
                          "followPerDay",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="1000"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newRateLimit.isActive}
                      onChange={(e) =>
                        handleNewRateLimitChange("isActive", e.target.checked)
                      }
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button
                    onClick={addRateLimit}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add Rate Limit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Rate Limit Modal */}
        {editingRateLimit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit Rate Limit</h3>
                <button
                  onClick={() => setEditingRateLimit(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DMs per Hour
                    </label>
                    <input
                      type="number"
                      value={editingRateLimit.dmPerHour}
                      onChange={(e) =>
                        setEditingRateLimit({
                          ...editingRateLimit,
                          dmPerHour: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DMs per Day
                    </label>
                    <input
                      type="number"
                      value={editingRateLimit.dmPerDay}
                      onChange={(e) =>
                        setEditingRateLimit({
                          ...editingRateLimit,
                          dmPerDay: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Follows per Hour
                    </label>
                    <input
                      type="number"
                      value={editingRateLimit.followPerHour}
                      onChange={(e) =>
                        setEditingRateLimit({
                          ...editingRateLimit,
                          followPerHour: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Follows per Day
                    </label>
                    <input
                      type="number"
                      value={editingRateLimit.followPerDay}
                      onChange={(e) =>
                        setEditingRateLimit({
                          ...editingRateLimit,
                          followPerDay: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      min="1"
                      max="1000"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingRateLimit.isActive}
                      onChange={(e) =>
                        setEditingRateLimit({
                          ...editingRateLimit,
                          isActive: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setEditingRateLimit(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      updateRateLimit(editingRateLimit.id, editingRateLimit)
                    }
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Accounts;
