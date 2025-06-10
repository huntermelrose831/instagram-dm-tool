import React, { useState, useEffect } from "react";
import {
  FaRobot,
  FaPlay,
  FaPause,
  FaStop,
  FaPlus,
  FaEdit,
  FaTrash,
  FaCog,
  FaLightbulb,
  FaChartLine,
  FaClock,
  FaReply,
  FaUsers,
  FaFilter,
  FaSave,
  FaTimes,
} from "react-icons/fa";

const SmartAutomation = () => {
  const [autoResponders, setAutoResponders] = useState([]);
  const [followUpSequences, setFollowUpSequences] = useState([]);
  const [activeTab, setActiveTab] = useState("auto-responders");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [newAutomation, setNewAutomation] = useState({
    name: "",
    type: "auto-responder",
    triggers: [],
    conditions: [],
    actions: [],
    isActive: true,
    priority: 1,
  });

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/automation");
      if (response.ok) {
        const data = await response.json();
        setAutoResponders(data.autoResponders || []);
        setFollowUpSequences(data.followUpSequences || []);
      }
    } catch (error) {
      console.error("Error fetching automations:", error);
    }
  };

  const createAutomation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAutomation),
      });

      if (response.ok) {
        fetchAutomations();
        setShowCreateModal(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error creating automation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutomation = async (id, isActive) => {
    try {
      await fetch(`http://localhost:5000/api/automation/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchAutomations();
    } catch (error) {
      console.error("Error toggling automation:", error);
    }
  };

  const deleteAutomation = async (id) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    try {
      await fetch(`http://localhost:5000/api/automation/${id}`, {
        method: "DELETE",
      });
      fetchAutomations();
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  };

  const resetForm = () => {
    setNewAutomation({
      name: "",
      type: "auto-responder",
      triggers: [],
      conditions: [],
      actions: [],
      isActive: true,
      priority: 1,
    });
  };

  const addTrigger = (trigger) => {
    setNewAutomation({
      ...newAutomation,
      triggers: [...newAutomation.triggers, trigger],
    });
  };

  const addCondition = (condition) => {
    setNewAutomation({
      ...newAutomation,
      conditions: [...newAutomation.conditions, condition],
    });
  };

  const addAction = (action) => {
    setNewAutomation({
      ...newAutomation,
      actions: [...newAutomation.actions, action],
    });
  };

  const AutomationCard = ({ automation, type }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              automation.isActive
                ? "bg-green-100 text-green-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <FaRobot />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{automation.name}</h3>
            <p className="text-sm text-gray-600 capitalize">
              {type.replace("-", " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              automation.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {automation.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Triggers</h4>
          <div className="flex flex-wrap gap-1">
            {automation.triggers?.map((trigger, index) => (
              <span
                key={index}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
              >
                {trigger.type}: {trigger.value}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Actions</h4>
          <div className="flex flex-wrap gap-1">
            {automation.actions?.map((action, index) => (
              <span
                key={index}
                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
              >
                {action.type}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Priority: {automation.priority}</span>
          <span>Executed: {automation.executionCount || 0} times</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAutomation(automation.id, automation.isActive)}
            className={`p-2 rounded-lg ${
              automation.isActive
                ? "text-red-600 hover:bg-red-50"
                : "text-green-600 hover:bg-green-50"
            }`}
            title={automation.isActive ? "Pause" : "Activate"}
          >
            {automation.isActive ? <FaPause /> : <FaPlay />}
          </button>
          <button
            onClick={() => setSelectedAutomation(automation)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => deleteAutomation(automation.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );

  const CreateAutomationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Create Smart Automation
          </h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Automation Name
              </label>
              <input
                type="text"
                value={newAutomation.name}
                onChange={(e) =>
                  setNewAutomation({ ...newAutomation, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Welcome Message"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={newAutomation.type}
                onChange={(e) =>
                  setNewAutomation({ ...newAutomation, type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="auto-responder">Auto Responder</option>
                <option value="follow-up-sequence">Follow-up Sequence</option>
                <option value="lead-qualifier">Lead Qualifier</option>
                <option value="engagement-booster">Engagement Booster</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={newAutomation.priority}
                onChange={(e) =>
                  setNewAutomation({
                    ...newAutomation,
                    priority: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Triggers
              </h3>
              <div className="space-y-2">
                {[
                  { type: "keyword", label: "Keyword mentioned" },
                  { type: "first-message", label: "First message received" },
                  { type: "time-delay", label: "Time delay" },
                  { type: "engagement", label: "User engagement" },
                ].map((trigger) => (
                  <button
                    key={trigger.type}
                    onClick={() =>
                      addTrigger({ type: trigger.type, value: "" })
                    }
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="font-medium">{trigger.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { type: "send-message", label: "Send Message", icon: FaReply },
              { type: "add-to-crm", label: "Add to CRM", icon: FaUsers },
              { type: "tag-contact", label: "Tag Contact", icon: FaFilter },
              {
                type: "schedule-follow-up",
                label: "Schedule Follow-up",
                icon: FaClock,
              },
              { type: "send-media", label: "Send Media", icon: FaLightbulb },
              {
                type: "qualify-lead",
                label: "Qualify Lead",
                icon: FaChartLine,
              },
            ].map((action) => (
              <button
                key={action.type}
                onClick={() => addAction({ type: action.type, config: {} })}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <action.icon className="text-blue-600" />
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={createAutomation}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FaSave />
            {isLoading ? "Creating..." : "Create Automation"}
          </button>
        </div>
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
              Smart Automation
            </h1>
            <p className="text-gray-600">
              Automate your Instagram DM responses and follow-ups
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus />
            Create Automation
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Active Automations",
              value: autoResponders.filter((a) => a.isActive).length,
              icon: FaRobot,
              color: "text-blue-600",
              bgColor: "bg-blue-50",
            },
            {
              title: "Messages Automated",
              value: "1,234",
              icon: FaReply,
              color: "text-green-600",
              bgColor: "bg-green-50",
            },
            {
              title: "Response Rate",
              value: "87%",
              icon: FaChartLine,
              color: "text-purple-600",
              bgColor: "bg-purple-50",
            },
            {
              title: "Time Saved",
              value: "24h",
              icon: FaClock,
              color: "text-orange-600",
              bgColor: "bg-orange-50",
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
                { id: "auto-responders", label: "Auto Responders" },
                { id: "follow-up-sequences", label: "Follow-up Sequences" },
                { id: "lead-qualifiers", label: "Lead Qualifiers" },
                { id: "analytics", label: "Analytics" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === "auto-responders" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Auto Responders
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {autoResponders.map((automation) => (
                  <AutomationCard
                    key={automation.id}
                    automation={automation}
                    type="auto-responder"
                  />
                ))}
                {autoResponders.length === 0 && (
                  <div className="col-span-2 text-center py-12">
                    <FaRobot className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No auto responders yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Create your first automation to start responding to
                      messages automatically
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Auto Responder
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "follow-up-sequences" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Follow-up Sequences
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {followUpSequences.map((automation) => (
                  <AutomationCard
                    key={automation.id}
                    automation={automation}
                    type="follow-up-sequence"
                  />
                ))}
                {followUpSequences.length === 0 && (
                  <div className="col-span-2 text-center py-12">
                    <FaClock className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No follow-up sequences yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Create automated follow-up sequences to nurture your leads
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Follow-up Sequence
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Automation Modal */}
      {showCreateModal && <CreateAutomationModal />}
    </div>
  );
};

export default SmartAutomation;
