import React, { useState, useEffect } from "react";
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
} from "react-icons/fa";

const DMForm = () => {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [targets, setTargets] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState(new Date());
  const [messageVariations, setMessageVariations] = useState([""]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Sending...");
    setError(null);

    try {
      const targetsList = targets
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const response = await fetch("/api/send-dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selected,
          usernames: targetsList,
          message: message,
          scheduled: isScheduled,
          scheduleTime: isScheduled ? scheduleTime : null,
          messageVariations: messageVariations.filter((v) => v.trim()),
        }),
      });

      const result = await response.json();
      if (result.status === "success") {
        setStatus("✅ Messages sent successfully!");
        setTargets("");
        setMessage("");
        setMessageVariations([""]);
      } else {
        setError(result.message || "Failed to send messages");
        setStatus("");
      }
    } catch (error) {
      setError("Network error: " + error.message);
      setStatus("");
    }
  };

  const addMessageVariation = () => {
    setMessageVariations([...messageVariations, ""]);
  };

  const removeMessageVariation = (index) => {
    if (messageVariations.length > 1) {
      setMessageVariations(messageVariations.filter((_, i) => i !== index));
    }
  };

  const updateMessageVariation = (index, value) => {
    const updated = [...messageVariations];
    updated[index] = value;
    setMessageVariations(updated);
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-black flex items-center">
            <FaEnvelope className="mr-3 text-green-600" />
            Send Direct Messages
          </h1>
          <p className="text-gray-600 mt-2">
            Send automated DMs to your target audience with A/B testing support
          </p>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Account Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                <FaUser className="mr-2 text-blue-600" />
                Select Account
              </h2>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
              >
                <option value="">Select an Instagram account</option>
                {accounts.map((account) => (
                  <option key={account.username} value={account.username}>
                    @{account.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Users */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                <FaUsers className="mr-2 text-purple-600" />
                Target Users
              </h2>
              <textarea
                value={targets}
                onChange={(e) => setTargets(e.target.value)}
                placeholder="Enter usernames separated by commas (e.g., user1, user2, user3)"
                required
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black placeholder-gray-500"
              />
              <p className="text-sm text-gray-500 mt-2">
                {targets
                  ? targets.split(",").filter((t) => t.trim()).length
                  : 0}{" "}
                targets specified
              </p>
            </div>

            {/* Message Variations */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-black flex items-center">
                  <FaRandom className="mr-2 text-yellow-600" />
                  Message Variations
                </h2>
                <button
                  type="button"
                  onClick={addMessageVariation}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                >
                  <FaPlus className="mr-2" />
                  Add Variation
                </button>
              </div>

              <div className="space-y-4">
                {messageVariations.map((variation, index) => (
                  <div key={index} className="relative">
                    <div className="flex items-start space-x-3">
                      <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium">
                        #{index + 1}
                      </div>
                      <textarea
                        value={variation}
                        onChange={(e) =>
                          updateMessageVariation(index, e.target.value)
                        }
                        placeholder={`Message variation ${index + 1}...`}
                        required={index === 0}
                        rows={3}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black placeholder-gray-500"
                      />
                      {messageVariations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMessageVariation(index)}
                          className="text-red-500 hover:text-red-700 p-2 transition-colors"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                Messages will be randomly selected from variations for A/B
                testing
              </p>
            </div>

            {/* Scheduling */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-black mb-4 flex items-center">
                <FaClock className="mr-2 text-indigo-600" />
                Scheduling Options
              </h2>

              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="schedule"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="mr-3 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="schedule" className="text-black font-medium">
                  Schedule for later
                </label>
              </div>

              {isScheduled && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleTime.toISOString().slice(0, 16)}
                    onChange={(e) => setScheduleTime(new Date(e.target.value))}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-black"
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={
                  !selected || !targets.trim() || !messageVariations[0].trim()
                }
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center transition-colors"
              >
                <FaPaperPlane className="mr-3" />
                {isScheduled ? "Schedule Messages" : "Send Messages Now"}
              </button>
            </div>

            {/* Status Messages */}
            {status && (
              <div className="text-center py-4">
                <div className="bg-green-100 border border-green-300 text-green-800 px-6 py-4 rounded-lg inline-block">
                  {status}
                </div>
              </div>
            )}

            {error && (
              <div className="text-center py-4">
                <div className="bg-red-100 border border-red-300 text-red-800 px-6 py-4 rounded-lg inline-block">
                  {error}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default DMForm;
