import React, { useState, useEffect } from "react";
import DateTimePicker from "react-datetime-picker";
import "react-datetime-picker/dist/DateTimePicker.css";
import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";

const ScheduleDM = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [targets, setTargets] = useState("");
  const [messages, setMessages] = useState([""]);
  const [scheduleTime, setScheduleTime] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("daily");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dmStats, setDmStats] = useState(null);

  useEffect(() => {
    // Load accounts
    fetch("http://localhost:5000/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data));
  }, []);

  useEffect(() => {
    // Load DM stats when account is selected
    if (selectedAccount) {
      fetch(`http://localhost:5000/api/dm-stats/${selectedAccount}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "success") {
            setDmStats(data.stats);
          }
        })
        .catch(console.error);
    }
  }, [selectedAccount]);

  const addMessageVariation = () => {
    setMessages([...messages, ""]);
  };

  const updateMessage = (index, value) => {
    const newMessages = [...messages];
    newMessages[index] = value;
    setMessages(newMessages);
  };

  const removeMessage = (index) => {
    if (messages.length > 1) {
      const newMessages = messages.filter((_, i) => i !== index);
      setMessages(newMessages);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    try {
      const targetUsernames = targets
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t);
      const messageVariations = messages.filter((m) => m.trim());

      if (!messageVariations.length) {
        throw new Error("At least one message is required");
      }

      const response = await fetch("http://localhost:5000/api/schedule-dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUsername: selectedAccount,
          targetUsernames,
          messageVariations,
          scheduleTime: scheduleTime.toISOString(),
          isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setStatus("DMs scheduled successfully!");
        // Reset form
        setTargets("");
        setMessages([""]);
        setScheduleTime(new Date());
      } else {
        setError(data.message || "Failed to schedule DMs");
      }
    } catch (err) {
      setError(err.message || "Failed to schedule DMs");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Schedule DMs</h2>

      {dmStats && (
        <div className="mb-6 p-4 bg-white rounded shadow">
          <h3 className="text-xl font-semibold mb-2">Rate Limits</h3>
          <div className="flex items-center mb-4">
            <div className="flex-grow">
              <div className="h-2 bg-gray-200 rounded">
                <div
                  className={`h-2 rounded ${
                    dmStats.daily_dm_count > dmStats.maxDMsPerDay * 0.8
                      ? "bg-red-500"
                      : dmStats.daily_dm_count > dmStats.maxDMsPerDay * 0.5
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
              {dmStats.daily_dm_count}/{dmStats.maxDMsPerDay} DMs sent today
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {dmStats.remainingDMs} DMs remaining today
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full p-2 border rounded"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Usernames (one per line)
          </label>
          <textarea
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            className="w-full p-2 border rounded"
            rows={4}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Variations
          </label>
          {messages.map((message, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <textarea
                value={message}
                onChange={(e) => updateMessage(index, e.target.value)}
                className="flex-grow p-2 border rounded"
                rows={2}
                required
              />
              <button
                type="button"
                onClick={() => removeMessage(index)}
                className="px-3 py-1 bg-red-500 text-white rounded"
                disabled={messages.length === 1}
              >
                X
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMessageVariation}
            className="text-blue-600 text-sm"
          >
            + Add message variation
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Schedule Time
          </label>
          <DateTimePicker
            onChange={setScheduleTime}
            value={scheduleTime}
            className="w-full p-2 border rounded"
            minDate={new Date()}
            required
          />
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">
              Recurring Schedule
            </span>
          </label>
        </div>

        {isRecurring && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repeat Interval
            </label>
            <select
              value={recurringInterval}
              onChange={(e) => setRecurringInterval(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}

        <button
          type="submit"
          className="w-full p-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
        >
          Schedule DMs
        </button>
      </form>

      {status && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded">
          {status}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}
    </div>
  );
};

export default ScheduleDM;
