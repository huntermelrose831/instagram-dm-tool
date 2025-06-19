import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  FaEnvelope,
  FaPaperPlane,
  FaClock,
  FaPlus,
  FaTrash,
  FaUser,
  FaUsers,
  FaCalendarAlt,
  FaRandom,
  FaPlay,
  FaStop,
  FaRedo,
  FaSpinner,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";

/**
 * TIMEZONE FIX: Formats a Date object into datetime-local format
 * Uses local timezone consistently to match backend expectations
 */
function formatLocalDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-indexed, so add 1
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Pad with zeros for consistent formatting
  const pad = (num) => String(num).padStart(2, "0");

  // Return in the exact format datetime-local expects
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

const Messaging = () => {
  const location = useLocation();

  // State for accounts and form data
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [targets, setTargets] = useState("");
  const [messages, setMessages] = useState([""]);
  // State for scheduling - TIMEZONE FIX: Use local time string format
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState(() => {
    // Initialize with current local time + 30 minutes
    const future = new Date(Date.now() + 30 * 60 * 1000);
    return formatLocalDateTime(future);
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("daily");

  // State for UI feedback
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // State for scheduled jobs
  const [scheduledJobs, setScheduledJobs] = useState([]);
  // State for active tab (send now vs schedule)
  const [activeTab, setActiveTab] = useState(() => {
    // Set initial tab based on route
    if (location.pathname === "/schedule-dm") return "schedule";
    return "send";
  });

  const recurringOptions = [
    { value: "hourly", label: "Every Hour" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];
  useEffect(() => {
    fetchAccounts();
    fetchScheduledJobs();

    // Update active tab based on route changes
    if (location.pathname === "/schedule-dm") {
      setActiveTab("schedule");
    } else if (location.pathname === "/send-dm") {
      setActiveTab("send");
    }
  }, [location.pathname]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const fetchScheduledJobs = async () => {
    try {
      const response = await fetch("/api/scheduled-jobs");
      const data = await response.json();
      if (data.status === "success") {
        setScheduledJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching scheduled jobs:", error);
    }
  };

  const addMessageVariation = () => {
    setMessages([...messages, ""]);
  };
  const updateMessage = useCallback((index, value) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages[index] = value;
      return newMessages;
    });
  }, []);

  const removeMessage = (index) => {
    if (messages.length > 1) {
      setMessages(messages.filter((_, i) => i !== index));
    }
  };

  const handleSendNow = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const targetsList = targets
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const validMessages = messages.filter((m) => m.trim());

      if (
        !selectedAccount ||
        targetsList.length === 0 ||
        validMessages.length === 0
      ) {
        throw new Error("Please fill in all required fields");
      }

      const response = await fetch("/api/send-dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedAccount,
          usernames: targetsList,
          message: validMessages[0], // Primary message
          messageVariations: validMessages,
        }),
      });

      const result = await response.json();
      if (result.status === "success") {
        setStatus("✅ Messages sent successfully!");
        setTargets("");
        setMessages([""]);
      } else {
        setError(result.message || "Failed to send messages");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const targetsList = targets
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const validMessages = messages.filter((m) => m.trim());

      if (
        !selectedAccount ||
        targetsList.length === 0 ||
        validMessages.length === 0
      ) {
        throw new Error("Please fill in all required fields");
      }
      const response = await fetch("/api/schedule-dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUsername: selectedAccount,
          targetUsernames: targetsList,
          messageVariations: validMessages,
          scheduleTime: scheduleTime, // Send as local time string, not ISO
          isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
        }),
      });

      const result = await response.json();
      if (result.status === "success") {
        setStatus("✅ DM scheduled successfully!");
        setTargets("");
        setMessages([""]);
        setScheduleTime(
          formatLocalDateTime(new Date(Date.now() + 30 * 60 * 1000))
        );
        fetchScheduledJobs();
      } else {
        setError(result.message || "Failed to schedule DM");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  const cancelJob = async (jobId) => {
    try {
      const response = await fetch(`/api/scheduled-jobs/${jobId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setStatus("Job cancelled successfully");
        fetchScheduledJobs();
      }
    } catch (error) {
      setError("Failed to cancel job");
    }
  };
  const deleteJob = async (jobId) => {
    // Add confirmation dialog
    if (
      !window.confirm(
        "Are you sure you want to delete this job? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-jobs/${jobId}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        setStatus("Job deleted successfully");
        fetchScheduledJobs();
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Failed to delete job");
      }
    } catch (error) {
      setError("Failed to delete job");
    }
  };

  const getJobStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      running: "bg-blue-100 text-blue-800 border-blue-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-black flex items-center">
            <FaEnvelope className="mr-3 text-green-600" />
            Instagram Messaging Center
          </h1>
          <p className="text-gray-600 mt-2">
            Send direct messages instantly or schedule campaigns for later
          </p>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab("send")}
                className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                  activeTab === "send"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <FaPaperPlane className="mr-2" />
                Send Now
              </button>
              <button
                onClick={() => setActiveTab("schedule")}
                className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                  activeTab === "schedule"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <FaClock className="mr-2" />
                Schedule Later
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-black mb-6 flex items-center">
                  {activeTab === "send" ? (
                    <>
                      <FaPaperPlane className="mr-2 text-green-600" />
                      Send Direct Messages
                    </>
                  ) : (
                    <>
                      <FaCalendarAlt className="mr-2 text-indigo-600" />
                      Schedule Campaign
                    </>
                  )}
                </h2>

                <form
                  onSubmit={
                    activeTab === "send" ? handleSendNow : handleSchedule
                  }
                  className="space-y-6"
                >
                  {/* Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaUser className="inline mr-2" />
                      Instagram Account
                    </label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
                    >
                      <option value="">Select an account</option>
                      {accounts.map((account) => (
                        <option key={account.username} value={account.username}>
                          @{account.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Users */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaUsers className="inline mr-2" />
                      Target Users
                    </label>
                    <textarea
                      value={targets}
                      onChange={(e) => setTargets(e.target.value)}
                      placeholder="Enter usernames separated by commas (e.g., user1, user2, user3)"
                      required
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {targets
                        ? targets.split(",").filter((t) => t.trim()).length
                        : 0}{" "}
                      targets
                    </p>
                  </div>

                  {/* Message Variations */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        <FaRandom className="inline mr-2" />
                        Message Variations
                      </label>
                      <button
                        type="button"
                        onClick={addMessageVariation}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center transition-colors"
                      >
                        <FaPlus className="mr-1" />
                        Add Variation
                      </button>
                    </div>

                    <div className="space-y-3">
                      {messages.map((message, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm font-medium min-w-max">
                            #{index + 1}
                          </div>
                          <textarea
                            value={message}
                            onChange={(e) =>
                              updateMessage(index, e.target.value)
                            }
                            placeholder={`Message variation ${index + 1}...`}
                            required={index === 0}
                            rows={3}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
                          />
                          {messages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMessage(index)}
                              className="text-red-500 hover:text-red-700 p-2 transition-colors"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Multiple variations help avoid spam detection and keep
                      messages personal
                    </p>
                  </div>

                  {/* Schedule Options (only for schedule tab) */}
                  {activeTab === "schedule" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FaClock className="inline mr-2" />
                          Schedule Time
                        </label>{" "}
                        <input
                          type="datetime-local"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          min={formatLocalDateTime(new Date())}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-black"
                          autoComplete="off"
                        />
                        {/* Timezone Debugging Panel */}
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                          <p className="font-semibold text-blue-700 mb-2">
                            The message will be sent at the following time:
                          </p>
                          <div className="space-y-1 text-gray-700">
                            {scheduleTime && (
                              <p className="text-indigo-600 font-medium">
                                {" "}
                                {new Date(
                                  scheduleTime.replace("T", " ")
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center mb-3">
                          <input
                            type="checkbox"
                            id="recurring"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="mr-3 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <label
                            htmlFor="recurring"
                            className="text-sm font-medium text-gray-700"
                          >
                            <FaRedo className="inline mr-2" />
                            Make this a recurring campaign
                          </label>
                        </div>

                        {isRecurring && (
                          <select
                            value={recurringInterval}
                            onChange={(e) =>
                              setRecurringInterval(e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-black"
                          >
                            {recurringOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !selectedAccount ||
                      !targets.trim() ||
                      !messages[0].trim()
                    }
                    className={`w-full ${
                      activeTab === "send"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    } disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center`}
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="mr-2 animate-spin" />
                        {activeTab === "send" ? "Sending..." : "Scheduling..."}
                      </>
                    ) : (
                      <>
                        {activeTab === "send" ? (
                          <>
                            <FaPaperPlane className="mr-2" />
                            Send Messages Now
                          </>
                        ) : (
                          <>
                            <FaCalendarAlt className="mr-2" />
                            Schedule DM
                          </>
                        )}
                      </>
                    )}
                  </button>

                  {/* Status Messages */}
                  {status && (
                    <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
                      {status}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Sidebar - Scheduled Jobs */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-black mb-6 flex items-center">
                  <FaPlay className="mr-2 text-blue-600" />
                  Scheduled Jobs ({scheduledJobs.length})
                </h2>

                {scheduledJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FaClock className="mx-auto text-3xl mb-3" />
                    <p className="text-sm">No scheduled jobs</p>
                    <p className="text-xs">
                      Use the schedule tab to create campaigns
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {scheduledJobs.map((job, index) => (
                      <div
                        key={job.id || index}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      >
                        {" "}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <span className="font-medium text-black text-sm">
                              @{job.from_username}
                            </span>
                            <span
                              className={`ml-2 px-2 py-1 rounded-full text-xs border ${getJobStatusColor(
                                job.status
                              )}`}
                            >
                              {job.status?.charAt(0).toUpperCase() +
                                job.status?.slice(1)}
                            </span>
                          </div>{" "}
                          <div className="flex items-center space-x-1">
                            {job.status === "pending" && (
                              <button
                                onClick={() => cancelJob(job.id)}
                                className="text-orange-500 hover:text-red-700 p-1 transition-colors"
                                title="Cancel Job"
                              >
                                <FaStop size={12} />
                              </button>
                            )}

                            {job.status === "running" && (
                              <div
                                className="text-blue-500 p-1"
                                title="Job is currently running"
                              >
                                <FaSpinner size={12} className="animate-spin" />
                              </div>
                            )}

                            {(job.status === "failed" ||
                              job.status === "completed" ||
                              job.status === "cancelled") && (
                              <button
                                onClick={() => deleteJob(job.id)}
                                className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                                title={`Delete ${job.status} job`}
                              >
                                <FaTrash size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>
                            <FaUsers className="inline mr-1" />
                            {
                              JSON.parse(job.target_usernames || "[]").length
                            }{" "}
                            targets
                          </p>
                          <p>
                            <FaClock className="inline mr-1" />
                            {new Date(
                              job.schedule_time.replace(" ", "T")
                            ).toLocaleString()}
                          </p>
                          {job.is_recurring && (
                            <p>
                              <FaRedo className="inline mr-1" />
                              Recurring: {job.recurring_interval}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
                <h3 className="text-lg font-semibold text-black mb-4">
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Accounts:</span>
                    <span className="font-medium">{accounts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending Jobs:</span>
                    <span className="font-medium">
                      {
                        scheduledJobs.filter((job) => job.status === "pending")
                          .length
                      }
                    </span>
                  </div>{" "}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completed Jobs:</span>
                    <span className="font-medium text-green-600">
                      {
                        scheduledJobs.filter(
                          (job) => job.status === "completed"
                        ).length
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Failed Jobs:</span>
                    <span className="font-medium text-red-600">
                      {
                        scheduledJobs.filter((job) => job.status === "failed")
                          .length
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messaging;
