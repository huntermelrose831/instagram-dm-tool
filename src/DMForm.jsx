import React, { useState, useEffect } from "react";
import DateTimePicker from "react-datetime-picker";
import "react-datetime-picker/dist/DateTimePicker.css";
import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";

const DMForm = () => {
  // State initialization
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem("savedAccounts");
    return saved ? JSON.parse(saved) : [];
  });
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [useCampaign, setUseCampaign] = useState(false);
  const [selected, setSelected] = useState(
    () => localStorage.getItem("selectedAccount") || ""
  );
  const [targets, setTargets] = useState(
    () => localStorage.getItem("dmTargets") || ""
  );
  const [message, setMessage] = useState(
    () => localStorage.getItem("dmMessage") || ""
  );
  const [status, setStatus] = useState("");
  const [isScheduled, setIsScheduled] = useState(() => {
    const saved = localStorage.getItem("isScheduled");
    return saved ? JSON.parse(saved) : false;
  });
  const [scheduleTime, setScheduleTime] = useState(() => {
    const saved = localStorage.getItem("scheduleTime");
    return saved ? new Date(JSON.parse(saved)) : new Date();
  });
  const [scheduledDMs, setScheduledDMs] = useState([]);
  const [dmStats, setDmStats] = useState(null);
  const [messageVariations, setMessageVariations] = useState(() => {
    const saved = localStorage.getItem("messageVariations");
    return saved ? JSON.parse(saved) : [""];
  });
  const [error, setError] = useState(null);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem("savedAccounts", JSON.stringify(accounts));
    localStorage.setItem("selectedAccount", selected);
    localStorage.setItem("dmTargets", targets);
    localStorage.setItem("dmMessage", message);
    localStorage.setItem("isScheduled", JSON.stringify(isScheduled));
    localStorage.setItem("scheduleTime", JSON.stringify(scheduleTime));
    localStorage.setItem(
      "messageVariations",
      JSON.stringify(messageVariations)
    );
  }, [
    accounts,
    selected,
    targets,
    message,
    isScheduled,
    scheduleTime,
    messageVariations,
  ]);

  useEffect(() => {
    fetch("http://localhost:5000/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts((prev) => {
          const combined = [...new Set([...prev, ...data])];
          return combined;
        });
      });
  }, []);

  useEffect(() => {
    if (selected) {
      fetch(`http://localhost:5000/api/dm-stats/${selected}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "success") {
            setDmStats(data.stats);
          }
        })
        .catch(console.error);
    }
  }, [selected]);

  // Add campaign fetching
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/campaigns");
      const data = await res.json();
      if (data.status === "success") {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    }
  };

  const addMessageVariation = () => {
    setMessageVariations([...messageVariations, ""]);
  };

  const updateMessageVariation = (index, value) => {
    const newMessages = [...messageVariations];
    newMessages[index] = value;
    setMessageVariations(newMessages);
  };

  const removeMessageVariation = (index) => {
    if (messageVariations.length > 1) {
      const newMessages = messageVariations.filter((_, i) => i !== index);
      setMessageVariations(newMessages);
    }
  };

  // Update campaign selection
  const handleCampaignSelect = (campaignId) => {
    const campaign = campaigns.find((c) => c.id === parseInt(campaignId));
    if (campaign) {
      setSelectedCampaign(campaign);
      setSelected(campaign.account_username);
      // Use the first message variation as default
      if (
        campaign.message_variations &&
        campaign.message_variations.length > 0
      ) {
        setMessage(campaign.message_variations[0]);
        setMessageVariations(
          typeof campaign.message_variations === "string"
            ? JSON.parse(campaign.message_variations)
            : campaign.message_variations
        );
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Sending...");

    if (useCampaign && !selectedCampaign) {
      setStatus("Please select a campaign");
      return;
    }

    const targetList = targets
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const endpoint = isScheduled ? "schedule-dms" : "send-dms";
      const response = await fetch(`http://localhost:5000/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selected, // Use 'username' for send-dms endpoint
          usernames: targetList, // Use 'usernames' for send-dms endpoint
          fromUsername: selected, // Use 'fromUsername' for schedule-dms endpoint
          targetUsernames: targetList, // Use 'targetUsernames' for schedule-dms endpoint
          message: message, // Use 'message' for non-scheduled DMs
          messageVariations: isScheduled
            ? useCampaign
              ? selectedCampaign.message_variations
              : [message]
            : undefined,
          scheduleTime: isScheduled ? scheduleTime.toISOString() : undefined,
          campaignId: useCampaign ? selectedCampaign.id : undefined,
          isRecurring: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.status === "success") {
        setStatus(
          isScheduled ? "DM scheduled successfully!" : "DM sent successfully!"
        );
        // Reset form
        if (!useCampaign) {
          setMessage("");
          setTargets("");
        }
        if (isScheduled) {
          setScheduleTime(new Date());
        }
      } else {
        setStatus(data.message || "Failed to send DM");
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus(
        `Failed to ${isScheduled ? "schedule" : "send"} DM: ${error.message}`
      );
    }
  };

  // Load scheduled DMs
  useEffect(() => {
    const loadScheduledDMs = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/scheduled-jobs"
        );
        const data = await response.json();
        if (data.status === "success") {
          setScheduledDMs(data.jobs);
        }
      } catch (error) {
        console.error("Failed to load scheduled DMs:", error);
      }
    };

    loadScheduledDMs();
    // Refresh every minute
    const interval = setInterval(loadScheduledDMs, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">Error: {error}</div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Send DM</h1>

      <div className="flex gap-8">
        {/* Main Form Section */}
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campaign Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="useCampaign"
                  checked={useCampaign}
                  onChange={(e) => {
                    setUseCampaign(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedCampaign(null);
                    }
                  }}
                  className="rounded"
                />
                <label htmlFor="useCampaign" className="font-medium">
                  Use Campaign
                </label>
              </div>

              {useCampaign && (
                <div className="mb-4">
                  <label className="block mb-1 font-medium">
                    Select Campaign
                  </label>
                  <select
                    value={selectedCampaign?.id || ""}
                    onChange={(e) => handleCampaignSelect(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required={useCampaign}
                  >
                    <option value="">Select a campaign</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Account Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <div>
                <label className="block mb-1 font-medium">From Account</label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
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

              {dmStats && (
                <div className="mt-4 bg-gray-50 rounded p-4">
                  <h3 className="text-sm font-semibold mb-2">Rate Limits</h3>
                  <div className="flex items-center">
                    <div className="flex-grow">
                      <div className="h-2 bg-gray-200 rounded">
                        <div
                          className={`h-2 rounded ${
                            dmStats.daily_dm_count > dmStats.maxDMsPerDay * 0.8
                              ? "bg-red-500"
                              : dmStats.daily_dm_count >
                                  dmStats.maxDMsPerDay * 0.5
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{
                            width: `${(dmStats.daily_dm_count / dmStats.maxDMsPerDay) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 text-sm">
                      {dmStats.daily_dm_count}/{dmStats.maxDMsPerDay} DMs sent
                      today
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target Users */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block mb-1 font-medium">Target Usernames</label>
              <textarea
                value={targets}
                onChange={(e) => setTargets(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={4}
                required
                placeholder="username1&#10;username2&#10;username3"
              />
            </div>

            {/* Message */}
            {!useCampaign && (
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block mb-1 font-medium">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  rows={4}
                  required={!useCampaign}
                  placeholder="Enter your message here..."
                />
              </div>
            )}

            {/* Scheduling */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="scheduleToggle"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                />
                <label htmlFor="scheduleToggle" className="font-medium">
                  Schedule for later
                </label>
              </div>

              {isScheduled && (
                <div className="mt-4">
                  <label className="block mb-1 font-medium">
                    Schedule Time
                  </label>
                  <DateTimePicker
                    onChange={setScheduleTime}
                    value={scheduleTime}
                    className="w-full bg-white"
                    minDate={new Date()}
                    required={isScheduled}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 w-full text-lg font-medium"
            >
              {isScheduled ? "Schedule DM" : "Send Now"}
            </button>

            {status && (
              <div
                className={`p-4 rounded ${
                  status === "Sending..."
                    ? "bg-gray-100"
                    : status.includes("success")
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {status}
              </div>
            )}
          </form>
        </div>

        {/* Scheduled DMs Sidebar */}
        <div className="w-96">
          <div className="bg-white rounded-lg shadow p-6 sticky top-8">
            <h2 className="text-xl font-bold mb-4">Scheduled Messages</h2>
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {scheduledDMs.length === 0 ? (
                <p className="text-gray-500">No scheduled messages</p>
              ) : (
                scheduledDMs.map((job) => (
                  <div key={job.id} className="border rounded p-4">
                    <div className="text-sm text-gray-600">
                      <div className="font-medium text-gray-900 mb-1">
                        {job.from_username}
                      </div>
                      <div className="mb-1">
                        To: {job.target_usernames.length} recipients
                      </div>
                      <div className="mb-1">
                        When: {formatDate(job.schedule_time)}
                      </div>
                      <div>
                        Status:{" "}
                        <span
                          className={`font-medium ${
                            job.status === "completed"
                              ? "text-green-600"
                              : job.status === "failed"
                                ? "text-red-600"
                                : job.status === "in_progress"
                                  ? "text-blue-600"
                                  : "text-gray-600"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DMForm;
