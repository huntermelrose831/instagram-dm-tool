import React, { useState, useEffect } from "react";
import {
  MdFileDownload,
  MdSchedule,
  MdFilterList,
  MdAdd,
  MdEdit,
  MdDelete,
  MdPlayArrow,
  MdSettings,
  MdTrendingUp,
  MdBarChart,
  MdPieChart,
  MdTableChart,
  MdEmail,
  MdCloud,
  MdRefresh,
} from "react-icons/md";

const ReportingExport = () => {
  const [activeTab, setActiveTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [scheduledReports, setScheduledReports] = useState([]);
  const [customReports, setCustomReports] = useState([]);
  const [exportJobs, setExportJobs] = useState([]);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // Report builder state
  const [reportConfig, setReportConfig] = useState({
    name: "",
    type: "standard",
    dateRange: "last_30_days",
    metrics: [],
    filters: {},
    visualization: "table",
    format: "pdf",
    recipients: [],
    schedule: {
      frequency: "manual",
      time: "09:00",
      days: [],
    },
  });

  useEffect(() => {
    fetchReports();
    fetchScheduledReports();
    fetchExportJobs();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/reports");
      const data = await response.json();
      setReports(data.reports || []);
      setCustomReports(data.customReports || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledReports = async () => {
    try {
      const response = await fetch("/api/reports/scheduled");
      const data = await response.json();
      setScheduledReports(data.scheduledReports || []);
    } catch (error) {
      console.error("Error fetching scheduled reports:", error);
    }
  };

  const fetchExportJobs = async () => {
    try {
      const response = await fetch("/api/exports/jobs");
      const data = await response.json();
      setExportJobs(data.jobs || []);
    } catch (error) {
      console.error("Error fetching export jobs:", error);
    }
  };

  const handleCreateReport = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/reports/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportConfig),
      });

      if (response.ok) {
        await fetchReports();
        setShowReportBuilder(false);
        resetReportConfig();
      }
    } catch (error) {
      console.error("Error creating report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (reportId, format) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/${reportId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${reportId}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting report:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetReportConfig = () => {
    setReportConfig({
      name: "",
      type: "standard",
      dateRange: "last_30_days",
      metrics: [],
      filters: {},
      visualization: "table",
      format: "pdf",
      recipients: [],
      schedule: {
        frequency: "manual",
        time: "09:00",
        days: [],
      },
    });
  };

  const availableMetrics = [
    { id: "messages_sent", label: "Messages Sent", category: "messaging" },
    {
      id: "responses_received",
      label: "Responses Received",
      category: "messaging",
    },
    { id: "leads_generated", label: "Leads Generated", category: "leads" },
    {
      id: "conversion_rate",
      label: "Conversion Rate",
      category: "performance",
    },
    {
      id: "account_engagement",
      label: "Account Engagement",
      category: "engagement",
    },
    { id: "follower_growth", label: "Follower Growth", category: "growth" },
    {
      id: "campaign_performance",
      label: "Campaign Performance",
      category: "campaigns",
    },
    {
      id: "automation_efficiency",
      label: "Automation Efficiency",
      category: "automation",
    },
  ];

  const reportTemplates = [
    {
      id: "daily_summary",
      name: "Daily Summary Report",
      description: "Key metrics and activities from the last 24 hours",
      metrics: ["messages_sent", "responses_received", "leads_generated"],
      visualization: "chart",
    },
    {
      id: "weekly_performance",
      name: "Weekly Performance Report",
      description: "Comprehensive weekly performance analysis",
      metrics: ["conversion_rate", "account_engagement", "follower_growth"],
      visualization: "dashboard",
    },
    {
      id: "campaign_analysis",
      name: "Campaign Analysis Report",
      description: "Detailed campaign performance and ROI analysis",
      metrics: ["campaign_performance", "automation_efficiency"],
      visualization: "table",
    },
    {
      id: "lead_generation",
      name: "Lead Generation Report",
      description: "Lead quality, sources, and conversion tracking",
      metrics: ["leads_generated", "conversion_rate"],
      visualization: "funnel",
    },
  ];

  const mockReports = [
    {
      id: 1,
      name: "Weekly Performance Summary",
      type: "scheduled",
      lastGenerated: "2024-12-20 09:00",
      nextGeneration: "2024-12-27 09:00",
      status: "active",
      format: "pdf",
      recipients: ["manager@company.com"],
    },
    {
      id: 2,
      name: "Campaign ROI Analysis",
      type: "custom",
      lastGenerated: "2024-12-19 14:30",
      status: "completed",
      format: "excel",
      downloadable: true,
    },
    {
      id: 3,
      name: "Lead Quality Assessment",
      type: "automated",
      lastGenerated: "2024-12-20 06:00",
      nextGeneration: "2024-12-21 06:00",
      status: "active",
      format: "csv",
    },
  ];

  const mockExportJobs = [
    {
      id: 1,
      name: "All Leads Export",
      type: "leads",
      status: "completed",
      progress: 100,
      createdAt: "2024-12-20 10:30",
      completedAt: "2024-12-20 10:32",
      recordCount: 1547,
      fileSize: "2.3 MB",
      downloadUrl: "/downloads/leads-export-123.csv",
    },
    {
      id: 2,
      name: "Campaign Data Export",
      type: "campaigns",
      status: "processing",
      progress: 67,
      createdAt: "2024-12-20 11:15",
      estimatedCompletion: "2024-12-20 11:25",
      recordCount: 890,
    },
    {
      id: 3,
      name: "Message History Export",
      type: "messages",
      status: "queued",
      progress: 0,
      createdAt: "2024-12-20 11:20",
      estimatedStart: "2024-12-20 11:30",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reporting & Export Center
        </h1>
        <p className="text-gray-600">
          Generate custom reports, schedule automated reporting, and export your
          data
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: "reports", label: "Reports", icon: MdBarChart },
          { id: "builder", label: "Report Builder", icon: MdSettings },
          { id: "scheduled", label: "Scheduled Reports", icon: MdSchedule },
          { id: "exports", label: "Data Exports", icon: MdFileDownload },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="mr-2" size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowReportBuilder(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <MdAdd className="mr-2" size={20} />
                Create Report
              </button>
              <button
                onClick={fetchReports}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center"
              >
                <MdRefresh className="mr-2" size={16} />
                Refresh
              </button>
            </div>
          </div>

          {/* Report Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {template.description}
                    </p>
                  </div>
                  <MdTableChart className="text-gray-400" size={20} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {template.metrics.length} metrics
                  </span>
                  <button
                    onClick={() => {
                      setReportConfig({
                        ...reportConfig,
                        name: template.name,
                        metrics: template.metrics,
                        visualization: template.visualization,
                      });
                      setShowReportBuilder(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Reports */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Reports
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Last Generated
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {report.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            report.type === "scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : report.type === "custom"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {report.lastGenerated}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            report.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {report.downloadable && (
                            <button
                              onClick={() =>
                                handleExportReport(report.id, report.format)
                              }
                              className="text-blue-600 hover:text-blue-800"
                              title="Download"
                            >
                              <MdFileDownload size={16} />
                            </button>
                          )}
                          <button
                            className="text-gray-600 hover:text-gray-800"
                            title="Edit"
                          >
                            <MdEdit size={16} />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <MdDelete size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Data Exports Tab */}
      {activeTab === "exports" && (
        <div className="space-y-6">
          {/* Export Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                type: "leads",
                label: "Export Leads",
                description: "All lead data with contact information",
                icon: MdTrendingUp,
              },
              {
                type: "messages",
                label: "Export Messages",
                description: "Message history and conversations",
                icon: MdEmail,
              },
              {
                type: "analytics",
                label: "Export Analytics",
                description: "Performance metrics and statistics",
                icon: MdBarChart,
              },
            ].map((exportType) => {
              const Icon = exportType.icon;
              return (
                <div
                  key={exportType.type}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center mb-4">
                    <Icon className="text-blue-600 mr-3" size={24} />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {exportType.label}
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-4">{exportType.description}</p>
                  <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    Start Export
                  </button>
                </div>
              );
            })}
          </div>

          {/* Export Jobs */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Export Jobs
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {mockExportJobs.map((job) => (
                <div
                  key={job.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{job.name}</h3>
                      <p className="text-sm text-gray-600">
                        {job.type} •{" "}
                        {job.recordCount
                          ? `${job.recordCount} records`
                          : "Processing..."}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        job.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : job.status === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {job.status === "processing" && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {job.status === "completed"
                        ? `Completed: ${job.completedAt}`
                        : job.status === "processing"
                          ? `Est. completion: ${job.estimatedCompletion}`
                          : `Queued: ${job.createdAt}`}
                    </span>
                    {job.status === "completed" && job.downloadUrl && (
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        Download ({job.fileSize})
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report Builder Modal */}
      {showReportBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Create Custom Report
              </h2>
              <button
                onClick={() => setShowReportBuilder(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>×
              </button>
            </div>

            <div className="space-y-6">
              {/* Report Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Name
                </label>
                <input
                  type="text"
                  value={reportConfig.name}
                  onChange={(e) =>
                    setReportConfig({ ...reportConfig, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter report name"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <select
                  value={reportConfig.dateRange}
                  onChange={(e) =>
                    setReportConfig({
                      ...reportConfig,
                      dateRange: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="last_90_days">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Metrics Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metrics to Include
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {availableMetrics.map((metric) => (
                    <label key={metric.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportConfig.metrics.includes(metric.id)}
                        onChange={(e) => {
                          const updatedMetrics = e.target.checked
                            ? [...reportConfig.metrics, metric.id]
                            : reportConfig.metrics.filter(
                                (m) => m !== metric.id
                              );
                          setReportConfig({
                            ...reportConfig,
                            metrics: updatedMetrics,
                          });
                        }}
                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {metric.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="flex space-x-4">
                  {["pdf", "excel", "csv"].map((format) => (
                    <label key={format} className="flex items-center">
                      <input
                        type="radio"
                        name="format"
                        value={format}
                        checked={reportConfig.format === format}
                        onChange={(e) =>
                          setReportConfig({
                            ...reportConfig,
                            format: e.target.value,
                          })
                        }
                        className="mr-2 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">
                        {format}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-4 pt-4">
                <button
                  onClick={() => setShowReportBuilder(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReport}
                  disabled={
                    !reportConfig.name ||
                    reportConfig.metrics.length === 0 ||
                    loading
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportingExport;
