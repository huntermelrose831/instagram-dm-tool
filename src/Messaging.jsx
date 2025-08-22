import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useMessagingState } from "./contexts/AppStateContext";
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
  FaCheckCircle,
  FaExclamationTriangle,
  FaChartLine,
} from "react-icons/fa";
import ProgressModal from "./components/ProgressModal";

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
  const { messagingState, setMessagingState } = useMessagingState();

  // Use context state for persistent data with fallbacks
  const {
    selectedAccount = "",
    targets = "",
    messages = [""],
    isScheduled = false,
    scheduleTime = "",
    isRecurring = false,
    recurringInterval = "daily",
    activeTab = "send",
  } = messagingState || {};

  // Helper to update context state
  const updateMessagingState = (updates) => {
    setMessagingState({ ...messagingState, ...updates });
  };

  // Local state for non-persistent data
  const [accounts, setAccounts] = useState([]);

  // State for UI feedback (not persisted)
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // State for scheduled jobs (not persisted)
  const [scheduledJobs, setScheduledJobs] = useState([]);

  // Initialize state from context or defaults
  useEffect(() => {
    if (!scheduleTime) {
      // Initialize with current local time + 30 minutes if not set
      const future = new Date(Date.now() + 30 * 60 * 1000);
      updateMessagingState({ scheduleTime: formatLocalDateTime(future) });
    }
  }, [scheduleTime]);

  // Setters that update context state
  const setSelectedAccount = (value) =>
    updateMessagingState({ selectedAccount: value });
  const setTargets = (value) => updateMessagingState({ targets: value });
  const setMessages = (value) => updateMessagingState({ messages: value });
  const setIsScheduled = (value) =>
    updateMessagingState({ isScheduled: value });
  const setScheduleTime = (value) =>
    updateMessagingState({ scheduleTime: value });
  const setIsRecurring = (value) =>
    updateMessagingState({ isRecurring: value });
  const setRecurringInterval = (value) =>
    updateMessagingState({ recurringInterval: value });
  const setActiveTab = (value) => updateMessagingState({ activeTab: value });

  // State for progress tracking
  const [progressSession, setProgressSession] = useState(null);
  const [progressEvents, setProgressEvents] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressError, setProgressError] = useState(false);

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

  useEffect(() => {
    if (!progressSession) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/dm-progress/${progressSession}`);
        if (!res.ok) return;
        const data = await res.json();
        setProgressEvents(data.events);
        const last = data.events[data.events.length - 1];
        if (last && typeof last.percent === "number")
          setProgressPercent(last.percent);
        if (data.done) {
          clearInterval(interval);
          setProgressComplete(true);
          setProgressError(last && last.stage === "error");
          // Auto-close after 5 seconds if successful
          if (last && last.stage === "finish") {
            setTimeout(() => {
              setShowProgress(false);
              setProgressSession(null);
              setProgressComplete(false);
              setProgressError(false);
            }, 5000);
          }
        }
      } catch (_) {}
    }, 2000); // increased from 1000ms to 2000ms to reduce server load
    return () => clearInterval(interval);
  }, [progressSession]);

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
    const currentMessages = Array.isArray(messages) ? messages : [""];
    setMessages([...currentMessages, ""]);
  };

  const updateMessage = useCallback(
    (index, value) => {
      const currentMessages = Array.isArray(messages) ? messages : [""];
      const newMessages = [...currentMessages];
      newMessages[index] = value;
      setMessages(newMessages);
    },
    [messages, setMessages]
  );

  const removeMessage = (index) => {
    const currentMessages = Array.isArray(messages) ? messages : [""];
    if (currentMessages.length > 1) {
      setMessages(currentMessages.filter((_, i) => i !== index));
    }
  };

  const handleSendNow = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    setProgressEvents([]);
    setProgressPercent(0);
    setShowProgress(true);
    setProgressComplete(false);
    setProgressError(false);

    try {
      const targetsList = targets
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const currentMessages = Array.isArray(messages) ? messages : [""];
      const validMessages = currentMessages.filter((m) => m.trim());
      if (
        !selectedAccount ||
        targetsList.length === 0 ||
        validMessages.length === 0
      ) {
        throw new Error("Please fill in all required fields");
      }
      
      // Start session
      const startRes = await fetch("/api/send-dms-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "mutatekey123",
        },
        body: JSON.stringify({
          email: selectedAccount,
          usernames: targetsList,
          message: validMessages[0],
          messageVariations: validMessages,
        }),
      });
      const startData = await startRes.json();
      if (startData.sessionId) {
        setProgressSession(startData.sessionId);
      } else {
        throw new Error("Failed to start progress session");
      }
    } catch (error) {
      setError(error.message);
      setShowProgress(false);
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
      const currentMessages = Array.isArray(messages) ? messages : [""];
      const validMessages = currentMessages.filter((m) => m.trim());

      if (
        !selectedAccount ||
        targetsList.length === 0 ||
        validMessages.length === 0
      ) {
        throw new Error("Please fill in all required fields");
      }
      // selectedAccount is now the email
      const selectedAccObj = accounts.find(
        (acc) => acc.email === selectedAccount
      );
      const selectedUsername = selectedAccObj ? selectedAccObj.username : "";
      const response = await fetch("/api/schedule-dms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "mutatekey123",
        },
        body: JSON.stringify({
          email: selectedAccount,
          usernames: targetsList,
          message: validMessages[0],
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
    try {
      const response = await fetch(`/api/scheduled-jobs/${jobId}/delete`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchScheduledJobs();
      } else {
        setError("Failed to delete job");
      }
    } catch (error) {
      setError("Failed to delete job");
    }
  };

  const closeProgressModal = () => {
    setShowProgress(false);
    setProgressSession(null);
    setProgressComplete(false);
    setProgressError(false);
    setProgressEvents([]);
    setProgressPercent(0);
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                  {activeTab === "send" ? (
                    <>
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <FaPaperPlane className="text-green-600 text-lg" />
                      </div>
                      Send Direct Messages
                    </>
                  ) : (
                    <>
                      <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                        <FaCalendarAlt className="text-indigo-600 text-lg" />
                      </div>
                      Schedule Campaign
                    </>
                  )}
                </h2>

                <form
                  onSubmit={
                    activeTab === "send" ? handleSendNow : handleSchedule
                  }
                  className="space-y-8"
                >
                  {/* Account Selection */}
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <div className="flex items-center">
                        <FaUser className="mr-2 text-gray-500" />
                        Instagram Account
                      </div>
                    </label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-gray-900 font-medium transition-all duration-200 hover:border-gray-300"
                    >
                      <option value="">Select an account</option>
                      {accounts.map((account) => (
                        <option key={account.email} value={account.email}>
                          {account.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Users */}
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <div className="flex items-center">
                        <FaUsers className="mr-2 text-gray-500" />
                        Target Users
                      </div>
                    </label>
                    <textarea
                      value={targets}
                      onChange={(e) => setTargets(e.target.value)}
                      placeholder="Enter usernames separated by commas (e.g., user1, user2, user3)"
                      required
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-gray-900 resize-none transition-all duration-200 hover:border-gray-300"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        {targets
                          ? targets.split(",").filter((t) => t.trim()).length
                          : 0}{" "}
                        targets
                      </p>
                      <span className="text-xs text-gray-400">
                        Separate with commas
                      </span>
                    </div>
                  </div>

                  {/* Message Variations */}
                  <div className="group">
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-semibold text-gray-700">
                        <div className="flex items-center">
                          <FaRandom className="mr-2 text-gray-500" />
                          Message Variations
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={addMessageVariation}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <FaPlus className="mr-2" />
                        Add Variation
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(Array.isArray(messages) ? messages : [""]).map(
                        (message, index) => (
                          <div
                            key={index}
                            className="flex items-start space-x-4"
                          >
                            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-bold min-w-max">
                              #{index + 1}
                            </div>
                            <div className="flex-1">
                              <textarea
                                value={message}
                                onChange={(e) =>
                                  updateMessage(index, e.target.value)
                                }
                                placeholder={`Message variation ${index + 1}...`}
                                required={index === 0}
                                rows={3}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-gray-900 resize-none transition-all duration-200 hover:border-gray-300"
                              />
                            </div>
                            {(Array.isArray(messages) ? messages : [""])
                              .length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMessage(index)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      💡 Multiple variations help avoid spam detection and keep
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
                  <div className="pt-6 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !selectedAccount ||
                        !(targets && targets.trim()) ||
                        !(
                          Array.isArray(messages) &&
                          messages[0] &&
                          messages[0].trim()
                        )
                      }
                      className={`w-full ${
                        activeTab === "send"
                          ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                          : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700"
                      } disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none`}
                    >
                      {loading ? (
                        <>
                          <FaSpinner className="mr-3 animate-spin" />
                          {activeTab === "send"
                            ? "Sending..."
                            : "Scheduling..."}
                        </>
                      ) : (
                        <>
                          {activeTab === "send" ? (
                            <>
                              <FaPaperPlane className="mr-3" />
                              Send Messages Now
                            </>
                          ) : (
                            <>
                              <FaCalendarAlt className="mr-3" />
                              Schedule Campaign
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status Messages */}
                  {status && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 px-6 py-4 rounded-xl flex items-center shadow-sm">
                      <FaCheckCircle className="mr-3 text-green-600" />
                      <span className="font-medium">{status}</span>
                    </div>
                  )}

                  {error && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-red-800 px-6 py-4 rounded-xl flex items-center shadow-sm">
                      <FaExclamationTriangle className="mr-3 text-red-600" />
                      <span className="font-medium">{error}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Sidebar - Scheduled Jobs */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <FaPlay className="text-blue-600" />
                  </div>
                  Scheduled Jobs ({scheduledJobs.length})
                </h2>

                {scheduledJobs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <FaClock className="text-3xl text-gray-400" />
                    </div>
                    <p className="text-lg font-medium mb-2">
                      No scheduled jobs
                    </p>
                    <p className="text-sm text-gray-400">
                      Use the schedule tab to create campaigns
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {scheduledJobs.map((job, index) => (
                      <div
                        key={job.id || index}
                        className="border-2 border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-gray-50 to-white"
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <FaChartLine className="text-purple-600" />
                  </div>
                  Quick Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                    <span className="text-gray-700 font-medium">
                      Total Accounts:
                    </span>
                    <span className="font-bold text-blue-600 text-lg">
                      {accounts.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                    <span className="text-gray-700 font-medium">
                      Pending Jobs:
                    </span>
                    <span className="font-bold text-yellow-600 text-lg">
                      {
                        scheduledJobs.filter((job) => job.status === "pending")
                          .length
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                    <span className="text-gray-700 font-medium">
                      Completed Jobs:
                    </span>
                    <span className="font-bold text-green-600 text-lg">
                      {
                        scheduledJobs.filter(
                          (job) => job.status === "completed"
                        ).length
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg">
                    <span className="text-gray-700 font-medium">
                      Failed Jobs:
                    </span>
                    <span className="font-bold text-red-600 text-lg">
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

      {/* Progress Modal */}
      <ProgressModal
        isOpen={showProgress}
        onClose={closeProgressModal}
        progress={progressPercent}
        events={progressEvents}
        isComplete={progressComplete}
        hasError={progressError}
      />
    </div>
  );
};

export default Messaging;
