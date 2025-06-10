import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MdAdd,
  MdSettings,
  MdGroup,
  MdEmail,
  MdAccountCircle,
  MdReply,
  MdPlayArrow,
  MdPause,
  MdDelete,
  MdEdit,
  MdMoreVert,
  MdTrendingUp,
  MdSchedule,
  MdCheck,
  MdClose,
} from "react-icons/md";

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState("settings");
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    account_username: "",
    daily_limit: 50,
    status: "draft",
  });
  const [accounts, setAccounts] = useState([]);
  const [targets, setTargets] = useState([]);
  const [newTarget, setNewTarget] = useState("");
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [replies, setReplies] = useState([]);
  useEffect(() => {
    fetchCampaigns();
    fetchAccounts();
  }, []);
  useEffect(() => {
    // Initialize editing campaign when selected campaign changes
    if (selectedCampaign) {
      setEditingCampaign({ ...selectedCampaign });
      fetchTargets(selectedCampaign.id);
      fetchReplies(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/campaigns");
      const data = await res.json();
      if (data.status === "success") {
        setCampaigns(data.campaigns);
        if (data.campaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data.campaigns[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchAccounts = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/accounts");
      const data = await response.json();
      if (Array.isArray(data)) {
        setAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const fetchTargets = async (campaignId) => {
    if (!campaignId) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}/targets`
      );
      if (response.ok) {
        const data = await response.json();
        setTargets(data.targets || []);
      }
    } catch (error) {
      console.error("Error fetching targets:", error);
    }
  };

  const addTarget = async (username) => {
    if (!selectedCampaign || !username.trim()) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${selectedCampaign.id}/targets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.replace("@", "") }),
        }
      );

      if (response.ok) {
        fetchTargets(selectedCampaign.id);
        setNewTarget("");
        setShowAddTarget(false);
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to add target");
      }
    } catch (error) {
      console.error("Error adding target:", error);
      alert("Network error: Failed to add target");
    }
  };

  const removeTarget = async (targetId) => {
    if (!selectedCampaign) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${selectedCampaign.id}/targets/${targetId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        fetchTargets(selectedCampaign.id);
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to remove target");
      }
    } catch (error) {
      console.error("Error removing target:", error);
      alert("Network error: Failed to remove target");
    }
  };

  const fetchReplies = async (campaignId) => {
    if (!campaignId) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}/replies`
      );
      if (response.ok) {
        const data = await response.json();
        setReplies(data.replies || []);
      }
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  };

  const updateCampaignField = (field, value) => {
    if (editingCampaign) {
      setEditingCampaign({
        ...editingCampaign,
        [field]: value,
      });
    }
  };

  const saveCampaignChanges = async () => {
    if (!editingCampaign) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${editingCampaign.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingCampaign),
        }
      );

      if (response.ok) {
        // Update local state
        setCampaigns(
          campaigns.map((c) =>
            c.id === editingCampaign.id ? editingCampaign : c
          )
        );
        setSelectedCampaign(editingCampaign);
      }
    } catch (error) {
      console.error("Error updating campaign:", error);
    }
  };
  const createCampaign = async () => {
    if (!newCampaign.name.trim()) return;

    console.log("Creating campaign with data:", newCampaign);

    try {
      const campaignData = {
        name: newCampaign.name,
        account_username: newCampaign.account_username,
        message_variations: ["Default message"], // Default message array
        target_usernames: [], // Empty target array initially
        schedule_time: null,
        is_scheduled: false,
      };

      console.log("Sending campaign data to API:", campaignData);

      const response = await fetch("http://localhost:5000/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignData),
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("Campaign created successfully:", result);
        fetchCampaigns(); // Refresh campaigns list
        setShowCreateModal(false);
        setNewCampaign({
          name: "",
          account_username: "",
          daily_limit: 50,
          status: "draft",
        });
      } else {
        const errorData = await response.json();
        console.error("Campaign creation failed:", errorData);
        alert(errorData.message || "Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Network error: Failed to create campaign");
    }
  };

  const launchCampaign = async (campaignId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}/launch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Campaign launched:", result);
        fetchCampaigns(); // Refresh to get updated status
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to launch campaign");
      }
    } catch (error) {
      console.error("Error launching campaign:", error);
      alert("Network error: Failed to launch campaign");
    }
  };

  const pauseCampaign = async (campaignId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}/pause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Campaign paused:", result);
        fetchCampaigns(); // Refresh to get updated status
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to pause campaign");
      }
    } catch (error) {
      console.error("Error pausing campaign:", error);
      alert("Network error: Failed to pause campaign");
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        console.log("Campaign deleted");
        fetchCampaigns(); // Refresh campaigns list
        if (selectedCampaign?.id === campaignId) {
          setSelectedCampaign(null);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
      alert("Network error: Failed to delete campaign");
    }
  };

  const CampaignCard = ({ campaign, isSelected, onClick }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
        isSelected
          ? "bg-green-500/10 border-green-500 shadow-lg"
          : "bg-gray-900 border-gray-700 hover:border-gray-600"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white truncate">{campaign.name}</h3>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            campaign.status === "active"
              ? "bg-green-500/20 text-green-400"
              : "bg-gray-500/20 text-gray-400"
          }`}
        >
          {campaign.status}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
        <div>
          <div className="font-medium text-white">
            {campaign.success_count || 0}
          </div>
          <div>Messages Sent</div>
        </div>
        <div>
          <div className="font-medium text-white">
            {campaign.response_count || 0}
          </div>
          <div>Replies</div>
        </div>
        <div>
          <div className="font-medium text-white">
            {campaign.success_count > 0
              ? Math.round(
                  (campaign.response_count / campaign.success_count) * 100
                )
              : 0}
            %
          </div>
          <div>Reply Rate</div>
        </div>
      </div>
    </motion.div>
  );
  const CampaignHeader = ({ campaign }) => {
    const [showActions, setShowActions] = useState(false);

    return (
      <div className="bg-gray-900 border-b border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">
              {campaign?.name || "New Campaign"}
            </h1>
            <button className="text-gray-400 hover:text-white">
              <MdEdit size={20} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => campaign && launchCampaign(campaign.id)}
              disabled={!campaign || campaign.status === "active"}
              className="px-4 py-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 text-black rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <MdPlayArrow size={18} />
              {campaign?.status === "active" ? "Active" : "Launch"}
            </button>
            <button
              onClick={() => campaign && pauseCampaign(campaign.id)}
              disabled={!campaign || campaign.status !== "active"}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <MdPause size={18} />
              Pause
            </button>
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <MdMoreVert size={20} />
              </button>
              {showActions && (
                <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                  <button
                    onClick={() => {
                      if (campaign) deleteCampaign(campaign.id);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2 transition-colors"
                  >
                    <MdDelete size={16} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {campaign && (
          <div className="grid grid-cols-3 gap-8 mt-6">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Messages Sent:</div>
              <div className="text-2xl font-bold text-blue-400">
                {campaign.success_count || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Replies:</div>
              <div className="text-2xl font-bold text-green-400">
                {campaign.response_count || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Reply Rate:</div>
              <div className="text-2xl font-bold text-purple-400">
                {campaign.success_count > 0
                  ? Math.round(
                      (campaign.response_count / campaign.success_count) * 100
                    )
                  : 0}
                %
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TabNavigation = () => {
    const tabs = [
      { id: "settings", label: "SETTINGS", icon: MdSettings },
      { id: "targets", label: "TARGETS", icon: MdGroup },
      { id: "sequences", label: "SEQUENCES", icon: MdEmail },
      { id: "accounts", label: "ACCOUNTS", icon: MdAccountCircle },
      { id: "replies", label: "REPLIES", icon: MdReply },
    ];

    return (
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-4 px-6 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-white bg-gray-700 border-b-2 border-green-500"
                  : "text-gray-400 hover:text-white hover:bg-gray-750"
              }`}
            >
              <tab.icon size={20} className="mb-1" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    );
  };
  const SettingsPanel = ({ campaign }) => (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={editingCampaign?.name || ""}
              onChange={(e) => updateCampaignField("name", e.target.value)}
              onBlur={saveCampaignChanges}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
              placeholder="Enter campaign name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Account
            </label>
            <select
              value={editingCampaign?.account_username || ""}
              onChange={(e) =>
                updateCampaignField("account_username", e.target.value)
              }
              onBlur={saveCampaignChanges}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.username} value={account.username}>
                  @{account.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Limit
            </label>
            <input
              type="number"
              value={editingCampaign?.daily_limit || 50}
              onChange={(e) =>
                updateCampaignField("daily_limit", parseInt(e.target.value))
              }
              onBlur={saveCampaignChanges}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
              placeholder="50"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Time Zone
            </label>
            <select className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none">
              <option>UTC-8 (Pacific Time)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Active Hours
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                defaultValue="09:00"
              />
              <input
                type="time"
                className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                defaultValue="17:00"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const TargetsPanel = ({ campaign }) => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Target Users</h2>
        <button
          onClick={() => setShowAddTarget(true)}
          className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <MdAdd size={18} />
          Add Target
        </button>
      </div>

      {showAddTarget && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Enter Instagram username (without @)"
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addTarget(newTarget);
                }
              }}
            />
            <button
              onClick={() => addTarget(newTarget)}
              disabled={!newTarget.trim()}
              className="px-4 py-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 text-black rounded-lg font-medium transition-colors"
            >
              <MdCheck size={18} />
            </button>
            <button
              onClick={() => {
                setShowAddTarget(false);
                setNewTarget("");
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              <MdClose size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              {targets.length} Target{targets.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-500">
              {targets.filter((t) => t.status === "completed").length} contacted
            </span>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {targets.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MdGroup className="mx-auto mb-2 text-3xl opacity-50" />
              <p>No targets added yet</p>
              <p className="text-sm">
                Add Instagram usernames to start your campaign
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-750"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <MdAccountCircle className="text-gray-400" size={20} />
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        @{target.username}
                      </div>
                      <div className="text-sm text-gray-400">
                        Status:{" "}
                        <span
                          className={`${
                            target.status === "completed"
                              ? "text-green-400"
                              : target.status === "pending"
                                ? "text-yellow-400"
                                : "text-gray-400"
                          }`}
                        >
                          {target.status || "Not contacted"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeTarget(target.id)}
                    className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <MdDelete size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const SequencesPanel = ({ campaign }) => {
    const [activeVariant, setActiveVariant] = useState("variant1");
    const [message, setMessage] = useState(
      "Do you do any outbound on Instagram currently?"
    );

    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            First message
          </h2>

          {/* Variant Tabs */}
          <div className="flex gap-2 mb-4">
            {[
              "VARIANT 1",
              "VARIANT 2",
              "VARIANT 3",
              "VARIANT 4",
              "VARIANT 5",
            ].map((variant, index) => (
              <button
                key={variant}
                onClick={() => setActiveVariant(`variant${index + 1}`)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeVariant === `variant${index + 1}`
                    ? "text-white border-green-500"
                    : "text-gray-400 border-transparent hover:text-white"
                }`}
              >
                {variant}
              </button>
            ))}
            <button className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white">
              ADD
            </button>
          </div>

          {/* Message Stats */}
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <MdEmail size={16} />
              15
            </div>
            <div className="flex items-center gap-1">
              <MdReply size={16} />5
            </div>
            <div className="flex items-center gap-1">
              <span>33%</span>
            </div>
            <button className="ml-auto px-3 py-1 bg-red-600 text-white text-xs rounded">
              DELETE VARIANT
            </button>
          </div>

          {/* Message Editor */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full h-32 p-4 bg-gray-800 border border-gray-600 rounded-lg text-white resize-none focus:border-green-500 focus:outline-none"
            placeholder="Enter your message..."
          />

          {/* Available Variables */}
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Available variables:
            </h3>
            <div className="space-y-1 text-sm text-gray-400">
              <div>
                <span className="text-green-400">{"{{firstName}}"}</span> -
                User's first name, parsed from full name (if no name, it will be
                replaced with their username)
              </div>
              <div>
                <span className="text-green-400">{"{{username}}"}</span> -
                Instagram username
              </div>
              <div>
                <span className="text-green-400">{"{{name}}"}</span> - User's
                full name (if no name, it will be replaced with username)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AccountsPanel = ({ campaign }) => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Connected Accounts</h2>
        <button className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black rounded-lg font-medium flex items-center gap-2 transition-colors">
          <MdAdd size={18} />
          Add Account
        </button>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              {accounts.length} Account{accounts.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-500">
              {accounts.filter((a) => a.status === "active").length} active
            </span>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {accounts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MdAccountCircle className="mx-auto mb-2 text-3xl opacity-50" />
              <p>No accounts connected</p>
              <p className="text-sm">
                Add Instagram accounts to start campaigns
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {accounts.map((account) => (
                <div
                  key={account.username}
                  className="p-4 flex items-center justify-between hover:bg-gray-750"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <MdAccountCircle className="text-white" size={24} />
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        @{account.username}
                      </div>
                      <div className="text-sm text-gray-400">
                        Status:{" "}
                        <span
                          className={`${
                            account.status === "active"
                              ? "text-green-400"
                              : account.status === "error"
                                ? "text-red-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {account.status || "Connected"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-blue-400 hover:text-blue-300 p-2 rounded-lg hover:bg-gray-700 transition-colors">
                      <MdEdit size={16} />
                    </button>
                    <button className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-gray-700 transition-colors">
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const RepliesPanel = ({ campaign }) => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Campaign Replies</h2>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <MdTrendingUp size={16} />
          {replies.length} total replies
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              Recent Activity
            </span>
            <span className="text-xs text-gray-500">
              {replies.filter((r) => r.is_read === false).length} unread
            </span>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {replies.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MdReply className="mx-auto mb-2 text-3xl opacity-50" />
              <p>No replies yet</p>
              <p className="text-sm">
                Replies will appear here when users respond to your messages
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {replies.map((reply) => (
                <div key={reply.id} className="p-4 hover:bg-gray-750">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <MdAccountCircle className="text-white" size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          @{reply.username}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(reply.created_at).toLocaleDateString()}
                        </span>
                        {!reply.is_read && (
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm">{reply.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
  const renderTabContent = () => {
    switch (activeTab) {
      case "settings":
        return <SettingsPanel campaign={selectedCampaign} />;
      case "sequences":
        return <SequencesPanel campaign={selectedCampaign} />;
      case "targets":
        return <TargetsPanel campaign={selectedCampaign} />;
      case "accounts":
        return <AccountsPanel campaign={selectedCampaign} />;
      case "replies":
        return <RepliesPanel campaign={selectedCampaign} />;
      default:
        return <SettingsPanel campaign={selectedCampaign} />;
    }
  };

  const CreateModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-96 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Create New Campaign
          </h3>
          <button
            onClick={() => setShowCreateModal(false)}
            className="text-gray-400 hover:text-white"
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              value={newCampaign.name}
              onChange={(e) =>
                setNewCampaign({ ...newCampaign, name: e.target.value })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
              placeholder="Enter campaign name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Account
            </label>{" "}
            <select
              value={newCampaign.account_username}
              onChange={(e) =>
                setNewCampaign({
                  ...newCampaign,
                  account_username: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.username} value={account.username}>
                  @{account.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Limit
            </label>
            <input
              type="number"
              value={newCampaign.daily_limit}
              onChange={(e) =>
                setNewCampaign({
                  ...newCampaign,
                  daily_limit: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
              min="1"
              max="200"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={createCampaign}
            disabled={!newCampaign.name.trim()}
            className="px-4 py-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 text-black rounded-lg font-medium transition-colors"
          >
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex h-screen">
        {/* Sidebar - Campaign List */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Campaigns</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2 bg-green-500 hover:bg-green-400 text-black rounded-lg"
              >
                <MdAdd size={20} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                isSelected={selectedCampaign?.id === campaign.id}
                onClick={() => setSelectedCampaign(campaign)}
              />
            ))}

            {campaigns.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <MdEmail className="mx-auto mb-2 text-3xl opacity-50" />
                <p>No campaigns yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-green-400 hover:text-green-300"
                >
                  Create your first campaign
                </button>
              </div>
            )}
          </div>
        </div>{" "}
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <CampaignHeader campaign={selectedCampaign} />
          <TabNavigation />
          <div className="flex-1 overflow-y-auto bg-gray-950">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && <CreateModal />}
    </div>
  );
};

export default Campaigns;
