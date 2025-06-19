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
  // Main state
  const [automationRules, setAutomationRules] = useState([]);
  const [automationSequences, setAutomationSequences] = useState([]);
  const [highValueLeads, setHighValueLeads] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [rulePerformance, setRulePerformance] = useState([]);
  const [sequencePerformance, setSequencePerformance] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState("auto-responders");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [newRule, setNewRule] = useState({
    name: "",
    trigger_type: "keyword",
    trigger_value: "",
    conditions: {},
    response_template: "",
    is_active: true,
    priority: 5,
  });

  const [newSequence, setNewSequence] = useState({
    name: "",
    trigger_event: "new_conversation",
    steps: [],
    is_active: true,
  });

  useEffect(() => {
    fetchAllData();
  }, []);
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchAutomationRules(),
        fetchAutomationSequences(),
        fetchHighValueLeads(),
        fetchMetrics(),
        fetchPerformanceData(),
      ]);
    } catch (error) {
      console.error("Error fetching automation data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchAutomationRules = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/rules"
      );
      if (response.ok) {
        const data = await response.json();
        setAutomationRules(data.rules || []);
      }
    } catch (error) {
      console.error("Error fetching automation rules:", error);
      setAutomationRules([]);
    }
  };
  const fetchAutomationSequences = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/sequences"
      );
      if (response.ok) {
        const data = await response.json();
        setAutomationSequences(data.sequences || []);
      }
    } catch (error) {
      console.error("Error fetching automation sequences:", error);
      setAutomationSequences([]);
    }
  };
  const fetchHighValueLeads = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/high-value-leads"
      );
      if (response.ok) {
        const data = await response.json();
        setHighValueLeads(data.leads || []);
      }
    } catch (error) {
      console.error("Error fetching high value leads:", error);
      setHighValueLeads([]);
    }
  };
  const fetchMetrics = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/metrics"
      );
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || {});
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
      setMetrics({});
    }
  };
  const fetchPerformanceData = async () => {
    try {
      const [rulesResponse, sequencesResponse] = await Promise.all([
        fetch("http://localhost:5000/api/automation/rules/performance"),
        fetch("http://localhost:5000/api/automation/sequences/performance"),
      ]);

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRulePerformance(rulesData.performance || []);
      }

      if (sequencesResponse.ok) {
        const sequencesData = await sequencesResponse.json();
        setSequencePerformance(sequencesData.performance || []);
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
      setRulePerformance([]);
      setSequencePerformance([]);
    }
  };
  const createAutomationRule = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/rules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newRule),
        }
      );

      if (response.ok) {
        await fetchAutomationRules();
        setShowCreateModal(false);
        resetRuleForm();
      }
    } catch (error) {
      console.error("Error creating automation rule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createAutomationSequence = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/sequences",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSequence),
        }
      );

      if (response.ok) {
        await fetchAutomationSequences();
        setShowSequenceModal(false);
        resetSequenceForm();
      }
    } catch (error) {
      console.error("Error creating automation sequence:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutomationRule = async (id, isActive) => {
    try {
      await fetch(`http://localhost:5000/api/automation/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      await fetchAutomationRules();
    } catch (error) {
      console.error("Error toggling automation rule:", error);
    }
  };

  const deleteAutomationRule = async (id) => {
    if (!confirm("Are you sure you want to delete this automation rule?"))
      return;

    try {
      await fetch(`http://localhost:5000/api/automation/rules/${id}`, {
        method: "DELETE",
      });
      await fetchAutomationRules();
    } catch (error) {
      console.error("Error deleting automation rule:", error);
    }
  };

  const analyzeMessage = async (messageText) => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/automation/analyze-message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: messageText }),
        }
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Error analyzing message:", error);
    }
    return null;
  };

  const triggerAutomation = async (ruleId, conversationId) => {
    try {
      await fetch("http://localhost:5000/api/automation/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: ruleId,
          conversation_id: conversationId,
        }),
      });
    } catch (error) {
      console.error("Error triggering automation:", error);
    }
  };
  const resetRuleForm = () => {
    setNewRule({
      name: "",
      trigger_type: "keyword",
      trigger_value: "",
      conditions: {},
      response_template: "",
      is_active: true,
      priority: 5,
    });
  };

  const resetSequenceForm = () => {
    setNewSequence({
      name: "",
      trigger_event: "new_conversation",
      steps: [],
      is_active: true,
    });
  };

  const addSequenceStep = () => {
    setNewSequence({
      ...newSequence,
      steps: [
        ...newSequence.steps,
        {
          step_number: newSequence.steps.length + 1,
          delay_hours: 24,
          message_template: "",
          conditions: {},
        },
      ],
    });
  };

  const removeSequenceStep = (index) => {
    const updatedSteps = newSequence.steps.filter((_, i) => i !== index);
    setNewSequence({
      ...newSequence,
      steps: updatedSteps.map((step, i) => ({ ...step, step_number: i + 1 })),
    });
  };
  const AutomationRuleCard = ({ rule }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              rule.is_active
                ? "bg-green-100 text-green-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <FaRobot />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{rule.name}</h3>
            <p className="text-sm text-gray-600">
              {rule.trigger_type}: {rule.trigger_value}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              rule.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {rule.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">
            Response Template
          </h4>
          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
            {rule.response_template?.substring(0, 100)}
            {rule.response_template?.length > 100 ? "..." : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Priority: {rule.priority}</span>
          <span>Executed: {rule.execution_count || 0} times</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAutomationRule(rule.id, rule.is_active)}
            className={`p-2 rounded-lg ${
              rule.is_active
                ? "text-red-600 hover:bg-red-50"
                : "text-green-600 hover:bg-green-50"
            }`}
            title={rule.is_active ? "Deactivate" : "Activate"}
          >
            {rule.is_active ? <FaPause /> : <FaPlay />}
          </button>
          <button
            onClick={() => setSelectedAutomation(rule)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => deleteAutomationRule(rule.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );

  const AutomationSequenceCard = ({ sequence }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              sequence.is_active
                ? "bg-purple-100 text-purple-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <FaClock />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{sequence.name}</h3>
            <p className="text-sm text-gray-600">
              Trigger: {sequence.trigger_event}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              sequence.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {sequence.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Steps</h4>
          <div className="space-y-1">
            {sequence.steps?.slice(0, 3).map((step, index) => (
              <div
                key={index}
                className="text-sm text-gray-600 flex items-center gap-2"
              >
                <span className="w-4 h-4 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center justify-center">
                  {step.step_number}
                </span>
                After {step.delay_hours}h:{" "}
                {step.message_template?.substring(0, 50)}...
              </div>
            ))}
            {sequence.steps?.length > 3 && (
              <div className="text-sm text-gray-500">
                +{sequence.steps.length - 3} more steps
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{sequence.steps?.length || 0} steps</span>
          <span>Completed: {sequence.completion_count || 0} times</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              toggleAutomationRule(sequence.id, sequence.is_active)
            }
            className={`p-2 rounded-lg ${
              sequence.is_active
                ? "text-red-600 hover:bg-red-50"
                : "text-green-600 hover:bg-green-50"
            }`}
            title={sequence.is_active ? "Deactivate" : "Activate"}
          >
            {sequence.is_active ? <FaPause /> : <FaPlay />}
          </button>
          <button
            onClick={() => setSelectedAutomation(sequence)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => deleteAutomationRule(sequence.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
  const CreateRuleModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Create Automation Rule
          </h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Welcome Message Rule"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Type
              </label>
              <select
                value={newRule.trigger_type}
                onChange={(e) =>
                  setNewRule({ ...newRule, trigger_type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="keyword">Keyword</option>
                <option value="first_message">First Message</option>
                <option value="message_count">Message Count</option>
                <option value="time_based">Time Based</option>
                <option value="sentiment">Sentiment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Value
              </label>
              <input
                type="text"
                value={newRule.trigger_value}
                onChange={(e) =>
                  setNewRule({ ...newRule, trigger_value: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="hello, hi, info"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Template
            </label>
            <textarea
              value={newRule.response_template}
              onChange={(e) =>
                setNewRule({ ...newRule, response_template: e.target.value })
              }
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Hello! Thanks for reaching out. How can I help you today?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={newRule.priority}
                onChange={(e) =>
                  setNewRule({ ...newRule, priority: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newRule.is_active}
                  onChange={(e) =>
                    setNewRule({ ...newRule, is_active: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={createAutomationRule}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FaSave />
            {isLoading ? "Creating..." : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );

  const CreateSequenceModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Create Follow-up Sequence
          </h2>
          <button
            onClick={() => setShowSequenceModal(false)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sequence Name
              </label>
              <input
                type="text"
                value={newSequence.name}
                onChange={(e) =>
                  setNewSequence({ ...newSequence, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Welcome Sequence"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Event
              </label>
              <select
                value={newSequence.trigger_event}
                onChange={(e) =>
                  setNewSequence({
                    ...newSequence,
                    trigger_event: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="new_conversation">New Conversation</option>
                <option value="no_response">No Response</option>
                <option value="keyword_match">Keyword Match</option>
                <option value="lead_qualified">Lead Qualified</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Sequence Steps
              </h3>
              <button
                onClick={addSequenceStep}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm"
              >
                <FaPlus />
                Add Step
              </button>
            </div>

            <div className="space-y-4">
              {newSequence.steps.map((step, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">
                      Step {step.step_number}
                    </h4>
                    <button
                      onClick={() => removeSequenceStep(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaTrash />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delay (hours)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={step.delay_hours}
                        onChange={(e) => {
                          const updatedSteps = [...newSequence.steps];
                          updatedSteps[index].delay_hours = parseInt(
                            e.target.value
                          );
                          setNewSequence({
                            ...newSequence,
                            steps: updatedSteps,
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message Template
                    </label>
                    <textarea
                      value={step.message_template}
                      onChange={(e) => {
                        const updatedSteps = [...newSequence.steps];
                        updatedSteps[index].message_template = e.target.value;
                        setNewSequence({ ...newSequence, steps: updatedSteps });
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Follow-up message template..."
                    />
                  </div>
                </div>
              ))}

              {newSequence.steps.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FaClock className="mx-auto text-4xl mb-2" />
                  <p>
                    No steps added yet. Click "Add Step" to create your
                    sequence.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newSequence.is_active}
                onChange={(e) =>
                  setNewSequence({
                    ...newSequence,
                    is_active: e.target.checked,
                  })
                }
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowSequenceModal(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={createAutomationSequence}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FaSave />
            {isLoading ? "Creating..." : "Create Sequence"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {" "}
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Smart Automation
            </h1>
            <p className="text-gray-600">
              Automate your Instagram DM responses and follow-ups with
              AI-powered intelligence
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaPlus />
              Create Rule
            </button>
            <button
              onClick={() => setShowSequenceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FaClock />
              Create Sequence
            </button>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {" "}
          {[
            {
              title: "Active Rules",
              value: (automationRules || []).filter((rule) => rule.is_active)
                .length,
              icon: FaRobot,
              color: "text-blue-600",
              bgColor: "bg-blue-50",
            },
            {
              title: "Messages Automated",
              value: metrics.total_executions || 0,
              icon: FaReply,
              color: "text-green-600",
              bgColor: "bg-green-50",
            },
            {
              title: "High-Value Leads",
              value: (highValueLeads || []).length,
              icon: FaChartLine,
              color: "text-purple-600",
              bgColor: "bg-purple-50",
            },
            {
              title: "Active Sequences",
              value: (automationSequences || []).filter((seq) => seq.is_active)
                .length,
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
        </div>{" "}
        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "auto-responders", label: "Auto Responder Rules" },
                { id: "follow-up-sequences", label: "Follow-up Sequences" },
                { id: "high-value-leads", label: "High-Value Leads" },
                { id: "analytics", label: "Performance Analytics" },
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Auto Responder Rules
                </h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FaPlus />
                  Create Rule
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {automationRules.map((rule) => (
                  <AutomationRuleCard key={rule.id} rule={rule} />
                ))}
                {automationRules.length === 0 && (
                  <div className="col-span-2 text-center py-12">
                    <FaRobot className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No automation rules yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Create your first automation rule to start responding to
                      messages automatically
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Auto Responder Rule
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "follow-up-sequences" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Follow-up Sequences
                </h2>
                <button
                  onClick={() => setShowSequenceModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <FaPlus />
                  Create Sequence
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {automationSequences.map((sequence) => (
                  <AutomationSequenceCard
                    key={sequence.id}
                    sequence={sequence}
                  />
                ))}
                {automationSequences.length === 0 && (
                  <div className="col-span-2 text-center py-12">
                    <FaClock className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No follow-up sequences yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Create automated follow-up sequences to nurture your leads
                      over time
                    </p>
                    <button
                      onClick={() => setShowSequenceModal(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Create Follow-up Sequence
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "high-value-leads" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                High-Value Leads
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {highValueLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {lead.username}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Lead Score: {lead.score}/100
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < Math.floor(lead.score / 20)
                                ? "bg-yellow-400"
                                : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Engagement:</span>
                        <span className="font-medium">
                          {lead.engagement_score || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Response Rate:</span>
                        <span className="font-medium">
                          {lead.response_rate || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last Activity:</span>
                        <span className="font-medium">
                          {lead.last_activity
                            ? new Date(lead.last_activity).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {lead.interests && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Interests
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {lead.interests
                            .split(",")
                            .slice(0, 3)
                            .map((interest, index) => (
                              <span
                                key={index}
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                              >
                                {interest.trim()}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        View Conversation
                      </button>
                      <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                        Add to CRM
                      </button>
                    </div>
                  </div>
                ))}
                {highValueLeads.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <FaUsers className="mx-auto text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No high-value leads identified yet
                    </h3>
                    <p className="text-gray-500">
                      As your automation rules process conversations, high-value
                      leads will appear here
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Performance Analytics
              </h2>

              {/* Rule Performance */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Rule Performance
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rule Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Executions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Success Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Response Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rulePerformance.map((rule) => (
                        <tr key={rule.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rule.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rule.execution_count || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rule.success_rate || 0}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rule.avg_response_time || 0}s
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                rule.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {rule.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rulePerformance.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No performance data available yet
                    </div>
                  )}
                </div>
              </div>

              {/* Sequence Performance */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Sequence Performance
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sequence Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Started
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completion Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sequencePerformance.map((sequence) => (
                        <tr key={sequence.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {sequence.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sequence.started_count || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sequence.completed_count || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sequence.completion_rate || 0}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                sequence.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {sequence.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sequencePerformance.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No sequence performance data available yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>{" "}
      {/* Modals */}
      {showCreateModal && <CreateRuleModal />}
      {showSequenceModal && <CreateSequenceModal />}
    </div>
  );
};

export default SmartAutomation;
