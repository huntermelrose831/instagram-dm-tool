import React, { useState, useEffect } from "react";
import {
  FaShieldAlt,
  FaExchangeAlt,
  FaGlobe,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaBan,
  FaPlay,
  FaPause,
  FaPlus,
  FaEdit,
  FaTrash,
  FaCog,
  FaChartLine,
  FaRobot,
  FaEye,
  FaUserShield,
} from "react-icons/fa";

const AccountSafety = () => {
  const [accounts, setAccounts] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [rateLimits, setRateLimits] = useState([]);
  const [activeTab, setActiveTab] = useState("accounts");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Form states
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

  useEffect(() => {
    fetchAccounts();
    fetchProxies();
    fetchRateLimits();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/account-safety/accounts"
      );
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const fetchProxies = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/account-safety/proxies"
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
        "http://localhost:5000/api/account-safety/rate-limits"
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
        "http://localhost:5000/api/account-safety/proxies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newProxy),
        }
      );

      if (response.ok) {
        fetchProxies();
        setNewProxy({
          host: "",
          port: "",
          username: "",
          password: "",
          type: "http",
        });
        setShowAddModal(false);
      }
    } catch (error) {
      console.error("Error adding proxy:", error);
    }
  };

  const toggleAccountRotation = async (accountId, enabled) => {
    try {
      await fetch(
        `http://localhost:5000/api/account-safety/accounts/${accountId}/rotation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !enabled }),
        }
      );
      fetchAccounts();
    } catch (error) {
      console.error("Error toggling account rotation:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-100";
      case "warning":
        return "text-yellow-600 bg-yellow-100";
      case "restricted":
        return "text-red-600 bg-red-100";
      case "banned":
        return "text-red-800 bg-red-200";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "healthy":
        return <FaCheckCircle className="text-green-600" />;
      case "warning":
        return <FaExclamationTriangle className="text-yellow-600" />;
      case "restricted":
        return <FaBan className="text-red-600" />;
      case "banned":
        return <FaBan className="text-red-800" />;
      default:
        return <FaClock className="text-gray-600" />;
    }
  };

  const AccountCard = ({ account }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {account.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">@{account.username}</h3>
            <p className="text-sm text-gray-600">{account.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(account.status)}
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(account.status)}`}
          >
            {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">DMs Today</p>
          <p className="text-lg font-semibold">
            {account.dmsToday}/{account.dailyDmLimit}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Follows Today</p>
          <p className="text-lg font-semibold">
            {account.followsToday}/{account.dailyFollowLimit}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Last Active</p>
          <p className="text-sm">
            {new Date(account.lastActive).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Proxy</p>
          <p className="text-sm">{account.proxyId ? "Connected" : "None"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              toggleAccountRotation(account.id, account.rotationEnabled)
            }
            className={`flex items-center gap-1 px-3 py-1 text-sm rounded-lg ${
              account.rotationEnabled
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <FaExchangeAlt />
            Rotation {account.rotationEnabled ? "On" : "Off"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <FaEye title="View Details" />
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <FaCog title="Settings" />
          </button>
        </div>
      </div>
    </div>
  );

  const ProxyCard = ({ proxy }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <FaGlobe />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {proxy.host}:{proxy.port}
            </h3>
            <p className="text-sm text-gray-600 capitalize">
              {proxy.type} Proxy
            </p>
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            proxy.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {proxy.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Connected Accounts</p>
          <p className="text-lg font-semibold">
            {proxy.connectedAccounts || 0}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Response Time</p>
          <p className="text-lg font-semibold">
            {proxy.responseTime || "N/A"}ms
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Success Rate</p>
          <p className="text-lg font-semibold">{proxy.successRate || 0}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Location</p>
          <p className="text-sm">{proxy.location || "Unknown"}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <FaEdit title="Edit" />
        </button>
        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
          <FaTrash title="Delete" />
        </button>
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
              Account Safety & Management
            </h1>
            <p className="text-gray-600">
              Manage account safety, proxies, and rate limits
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus />
            Add Resource
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Healthy Accounts",
              value: accounts.filter((a) => a.status === "healthy").length,
              total: accounts.length,
              icon: FaUserShield,
              color: "text-green-600",
              bgColor: "bg-green-50",
            },
            {
              title: "Active Proxies",
              value: proxies.filter((p) => p.isActive).length,
              total: proxies.length,
              icon: FaGlobe,
              color: "text-blue-600",
              bgColor: "bg-blue-50",
            },
            {
              title: "Rate Limit Violations",
              value: 3,
              total: null,
              icon: FaExclamationTriangle,
              color: "text-yellow-600",
              bgColor: "bg-yellow-50",
            },
            {
              title: "Automation Running",
              value: "24/7",
              total: null,
              icon: FaRobot,
              color: "text-purple-600",
              bgColor: "bg-purple-50",
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
                    {stat.total && (
                      <span className="text-sm text-gray-500">
                        /{stat.total}
                      </span>
                    )}
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
                { id: "accounts", label: "Account Health", icon: FaUserShield },
                { id: "proxies", label: "Proxy Management", icon: FaGlobe },
                { id: "rate-limits", label: "Rate Limits", icon: FaClock },
                {
                  id: "security",
                  label: "Security Settings",
                  icon: FaShieldAlt,
                },
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
          {activeTab === "accounts" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Account Health Monitor
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {accounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "proxies" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Proxy Management
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {proxies.map((proxy) => (
                  <ProxyCard key={proxy.id} proxy={proxy} />
                ))}
                {proxies.length === 0 && (
                  <div className="col-span-3 text-center py-12">
                    <FaGlobe className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No proxies configured
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Add proxies to protect your accounts and improve security
                    </p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Proxy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "rate-limits" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Rate Limit Configuration
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        DMs/Hour
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        DMs/Day
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Follows/Hour
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
                      <tr key={limit.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                              {limit.accountUsername?.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                @{limit.accountUsername}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {limit.dmPerHour}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {limit.dmPerDay}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {limit.followPerHour}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              limit.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {limit.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">
                            Edit
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Security Settings
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Account Rotation
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2">
                        Enable automatic account rotation
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2">
                        Rotate accounts after rate limit warnings
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2">
                        Smart rotation based on activity patterns
                      </span>
                    </label>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Safety Features
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2">Human-like activity patterns</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2">
                        Random delays between actions
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                      <span className="ml-2">
                        Account warming for new accounts
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSafety;
