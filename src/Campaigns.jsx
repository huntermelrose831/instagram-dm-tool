import React, { useState, useEffect } from "react";
import DateTimePicker from "react-datetime-picker";
import { MdAdd, MdClose, MdPause, MdPlayArrow, MdDelete } from "react-icons/md";

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <MdClose size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    account_username: "",
    message_variations: [""],
    target_usernames: [],
    schedule_time: new Date(),
    is_scheduled: false,
  });
  const [status, setStatus] = useState("");
  const [targetUsername, setTargetUsername] = useState("");

  useEffect(() => {
    fetchCampaigns();
    fetchAccounts();
  }, []);
  const fetchCampaigns = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/campaigns");
      const data = await res.json();
      if (data.status === "success") {
        // Parse message_variations from JSON string if it's a string
        const processedCampaigns = data.campaigns.map((campaign) => ({
          ...campaign,
          message_variations:
            typeof campaign.message_variations === "string"
              ? JSON.parse(campaign.message_variations)
              : campaign.message_variations,
          variation_stats: campaign.variation_stats || [],
        }));
        setCampaigns(processedCampaigns);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/accounts");
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    setStatus("");

    try {
      const res = await fetch("http://localhost:5000/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign),
      });

      const data = await res.json();
      if (data.status === "success") {
        setStatus("Campaign created successfully!");
        fetchCampaigns();
        setShowModal(false);
        resetNewCampaign();
      } else {
        setStatus(data.message || "Failed to create campaign");
      }
    } catch (error) {
      setStatus("Failed to create campaign");
    }
  };

  const resetNewCampaign = () => {
    setNewCampaign({
      name: "",
      account_username: "",
      message_variations: [""],
      target_usernames: [],
      schedule_time: new Date(),
      is_scheduled: false,
    });
  };

  const addMessageVariation = () => {
    setNewCampaign({
      ...newCampaign,
      message_variations: [...newCampaign.message_variations, ""],
    });
  };

  const updateMessageVariation = (index, value) => {
    const variations = [...newCampaign.message_variations];
    variations[index] = value;
    setNewCampaign({ ...newCampaign, message_variations: variations });
  };

  const removeMessageVariation = (index) => {
    if (newCampaign.message_variations.length > 1) {
      const variations = newCampaign.message_variations.filter(
        (_, i) => i !== index
      );
      setNewCampaign({ ...newCampaign, message_variations: variations });
    }
  };

  const addTargetUsername = () => {
    if (
      targetUsername &&
      !newCampaign.target_usernames.includes(targetUsername)
    ) {
      setNewCampaign({
        ...newCampaign,
        target_usernames: [...newCampaign.target_usernames, targetUsername],
      });
      setTargetUsername("");
    }
  };

  const removeTargetUsername = (username) => {
    setNewCampaign({
      ...newCampaign,
      target_usernames: newCampaign.target_usernames.filter(
        (u) => u !== username
      ),
    });
  };

  const updateCampaignStatus = async (campaignId, newStatus) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (res.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Failed to update campaign status:", error);
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!window.confirm("Are you sure you want to delete this campaign?"))
      return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/campaigns/${campaignId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-6 mb-8">
        <h1 className="text-3xl font-bold">Campaign Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-secondary text-white px-4 py-2 rounded hover:bg-gray-700 w-fit flex items-center gap-2"
        >
          <MdAdd size={20} />
          New Campaign
        </button>
      </div>

      {/* Campaign Creation Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <h2 className="text-xl font-semibold mb-4">Create New Campaign</h2>
        <form onSubmit={createCampaign} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Campaign Name</label>
            <input
              type="text"
              value={newCampaign.name}
              onChange={(e) =>
                setNewCampaign({ ...newCampaign, name: e.target.value })
              }
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">From Account</label>
            <select
              value={newCampaign.account_username}
              onChange={(e) =>
                setNewCampaign({
                  ...newCampaign,
                  account_username: e.target.value,
                })
              }
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select an account</option>
              {accounts.map((acc) => (
                <option key={acc.username} value={acc.username}>
                  {acc.username}
                </option>
              ))}
            </select>
          </div>
          {/* Target Usernames */}
          <div>
            <label className="block mb-1 font-medium">Target Usernames</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="flex-1 border rounded px-3 py-2"
                placeholder="Enter username"
              />{" "}
              <button
                type="button"
                onClick={addTargetUsername}
                className="bg-secondary text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {newCampaign.target_usernames.map((username) => (
                <span
                  key={username}
                  className="bg-gray-100 px-2 py-1 rounded flex items-center gap-1"
                >
                  {username}
                  <button
                    type="button"
                    onClick={() => removeTargetUsername(username)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <MdClose size={16} />
                  </button>
                </span>
              ))}
            </div>
          </div>
          {/* Message Variations */}
          <div>
            <label className="block mb-1 font-medium">
              Message Variations (A/B Testing)
            </label>
            {newCampaign.message_variations.map((msg, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <textarea
                  value={msg}
                  onChange={(e) => updateMessageVariation(i, e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                  rows={3}
                  required
                />
                {newCampaign.message_variations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMessageVariation(i)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <MdClose size={20} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addMessageVariation}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
            >
              <MdAdd size={16} /> Add Message Variation
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="scheduleToggle"
              checked={newCampaign.is_scheduled}
              onChange={(e) =>
                setNewCampaign({
                  ...newCampaign,
                  is_scheduled: e.target.checked,
                })
              }
            />
            <label htmlFor="scheduleToggle" className="font-medium">
              Schedule Campaign
            </label>
          </div>
          {newCampaign.is_scheduled && (
            <div>
              <label className="block mb-1 font-medium">Schedule Time</label>
              <DateTimePicker
                onChange={(value) =>
                  setNewCampaign({ ...newCampaign, schedule_time: value })
                }
                value={newCampaign.schedule_time}
                className="w-full"
                minDate={new Date()}
                required
              />
            </div>
          )}{" "}
          <button
            type="submit"
            className="bg-secondary text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Create Campaign
          </button>
        </form>

        {status && (
          <div
            className={`mt-4 p-3 rounded ${
              status.includes("success")
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {status}
          </div>
        )}
      </Modal>

      {/* Campaign List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">All Campaigns</h2>
        </div>
        <div className="divide-y">
          {campaigns.length === 0 ? (
            <div className="p-6 text-gray-500">No campaigns created yet</div>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium">{campaign.name}</h3>
                    <p className="text-sm text-gray-600">
                      Account: {campaign.account_username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        campaign.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100"
                      }`}
                    >
                      {campaign.status}
                    </span>
                    <button
                      onClick={() =>
                        updateCampaignStatus(
                          campaign.id,
                          campaign.status === "active" ? "paused" : "active"
                        )
                      }
                      className="text-secondary hover:text-gray-700"
                      title={
                        campaign.status === "active"
                          ? "Pause Campaign"
                          : "Resume Campaign"
                      }
                    >
                      {campaign.status === "active" ? (
                        <MdPause size={20} />
                      ) : (
                        <MdPlayArrow size={20} />
                      )}
                    </button>
                    <button
                      onClick={() => deleteCampaign(campaign.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Campaign"
                    >
                      <MdDelete size={20} />
                    </button>
                  </div>
                </div>
                {/* Campaign Stats */}
                <div className="grid grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                  <div>
                    <span className="block font-medium">Messages Sent</span>
                    {campaign.success_count}/{campaign.target_count}
                  </div>
                  <div>
                    <span className="block font-medium">Responses</span>
                    {campaign.response_count}
                  </div>
                  <div>
                    <span className="block font-medium">Success Rate</span>
                    {campaign.target_count
                      ? `${((campaign.success_count / campaign.target_count) * 100).toFixed(1)}%`
                      : "0%"}
                  </div>
                  <div>
                    <span className="block font-medium">Response Rate</span>
                    {campaign.success_count
                      ? `${((campaign.response_count / campaign.success_count) * 100).toFixed(1)}%`
                      : "0%"}
                  </div>
                </div>{" "}
                {/* A/B Testing Results */}
                {campaign.message_variations &&
                  campaign.message_variations.length > 1 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">A/B Testing Results</h4>
                      <div className="grid grid-cols-1 gap-4">
                        {campaign.message_variations.map((variation, index) => {
                          const stats = campaign.variation_stats[index] || {
                            sent: 0,
                            responses: 0,
                          };
                          return (
                            <div key={index} className="bg-gray-50 p-4 rounded">
                              <div className="flex justify-between mb-2">
                                <div className="text-sm font-medium">
                                  Variation {index + 1}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {variation.substring(0, 50)}...
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="block font-medium">
                                    Messages Sent
                                  </span>
                                  {stats.sent}
                                </div>
                                <div>
                                  <span className="block font-medium">
                                    Responses
                                  </span>
                                  {stats.responses}
                                </div>
                                <div>
                                  <span className="block font-medium">
                                    Response Rate
                                  </span>
                                  {stats.sent
                                    ? `${((stats.responses / stats.sent) * 100).toFixed(1)}%`
                                    : "0%"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
