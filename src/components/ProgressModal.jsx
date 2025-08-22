import React from "react";
import {
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
} from "react-icons/fa";

const ProgressModal = ({
  isOpen,
  onClose,
  progress,
  events,
  isComplete,
  hasError,
}) => {
  if (!isOpen) return null;

  const getEventIcon = (stage) => {
    if (stage === "finish") return <FaCheckCircle className="text-green-500" />;
    if (stage === "error" || stage === "target_error")
      return <FaExclamationTriangle className="text-red-500" />;
    return <FaSpinner className="text-blue-500 animate-spin" />;
  };

  const getEventColor = (stage) => {
    if (stage === "finish") return "text-green-700";
    if (stage === "error" || stage === "target_error") return "text-red-700";
    return "text-gray-700";
  };

  // Filter and simplify events for better UX
  const importantEvents = events.filter((event) => {
    const stage = event.stage;
    return (
      stage === "start" ||
      stage === "launch_browser" ||
      stage === "set_cookies" ||
      stage === "navigate_dm" ||
      stage === "message_sent" ||
      stage === "target_complete" ||
      stage === "target_error" ||
      stage === "finish" ||
      stage === "error"
    );
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isComplete ? (
                <FaCheckCircle className="text-green-500 text-2xl" />
              ) : hasError ? (
                <FaExclamationTriangle className="text-red-500 text-2xl" />
              ) : (
                <FaSpinner className="text-blue-500 text-2xl animate-spin" />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isComplete
                    ? "Campaign Complete"
                    : hasError
                      ? "Campaign Error"
                      : "Sending Messages"}
                </h2>
                <p className="text-sm text-gray-600">
                  {isComplete
                    ? "All messages have been processed"
                    : hasError
                      ? "An error occurred during processing"
                      : "Processing your DM campaign..."}
                </p>
              </div>
            </div>
            {isComplete && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-gray-900">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ease-out rounded-full ${
                isComplete
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : hasError
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600"
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Events List */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Activity Log
          </h3>
          <div className="space-y-3">
            {importantEvents.slice(-10).map((event, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getEventIcon(event.stage)}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${getEventColor(event.stage)}`}
                  >
                    {event.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(event.time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {importantEvents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FaSpinner className="mx-auto text-2xl mb-2 animate-spin" />
                <p className="text-sm">Initializing...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {isComplete && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressModal;
