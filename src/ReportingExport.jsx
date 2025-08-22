import React, { useState, useEffect } from "react";
import { useReportsState } from "./contexts/AppStateContext";
import {
  MdFileDownload,
  MdSchedule,
  MdAdd,
  MdEdit,
  MdDelete,
  MdPlayArrow,
  MdSettings,
  MdTrendingUp,
  MdBarChart,
  MdTableChart,
  MdEmail,
  MdRefresh,
  MdAccessTime,
} from "react-icons/md";

const ReportingExport = () => {
  const { reportsState, setReportsState } = useReportsState();

  // Use context state instead of local state
  const {
    activeTab,
    reports,
    scheduledReports,
    exportJobs,
    showReportBuilder,
    reportConfig,
  } = reportsState;

  // Local state for loading and API data
  const [loading, setLoading] = useState(false);

  // Helper functions to update context state
  const updateState = (updates) => {
    setReportsState({ ...reportsState, ...updates });
  };

  const setActiveTab = (tab) => updateState({ activeTab: tab });
  const setReports = (reports) => updateState({ reports });
  const setScheduledReports = (scheduledReports) =>
    updateState({ scheduledReports });
  const setExportJobs = (exportJobs) => updateState({ exportJobs });
  const setShowReportBuilder = (show) =>
    updateState({ showReportBuilder: show });
  const setReportConfig = (config) => updateState({ reportConfig: config });

  useEffect(() => {
    fetchReports();
    fetchScheduled();
    fetchExportJobs();

    // Poll export jobs less frequently - only every 30 seconds instead of 5
    const poll = setInterval(() => {
      fetchExportJobs();
    }, 30000);

    return () => clearInterval(poll);
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setReports(data.reports || []);
    } catch (e) {
      console.error(e);
    }
  };
  const fetchScheduled = async () => {
    try {
      const res = await fetch("/api/reports/scheduled");
      const data = await res.json();
      setScheduledReports(data.scheduledReports || []);
    } catch (e) {
      console.error(e);
    }
  };
  const fetchExportJobs = async () => {
    try {
      const res = await fetch("/api/exports/jobs");
      const data = await res.json();
      setExportJobs(data.jobs || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateReport = async () => {
    if (!reportConfig.name || reportConfig.metrics.length === 0) return;
    setLoading(true);
    try {
      await fetch("/api/reports/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportConfig),
      });
      setShowReportBuilder(false);
      setReportConfig({
        name: "",
        type: "standard",
        dateRange: "last_30_days",
        metrics: [],
        filters: {},
        visualization: "table",
        format: "csv",
        schedule: { frequency: "manual", time: "09:00", days: [] },
      });
      fetchReports();
      fetchScheduled();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunReport = async (id) => {
    try {
      await fetch(`/api/reports/${id}/run`, { method: "POST" });
      fetchReports();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportReport = async (id, format = "csv") => {
    try {
      const res = await fetch(`/api/reports/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${id}.${format === "excel" ? "csv" : format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReport = async (id) => {
    if (!window.confirm("Delete this report?")) return;
    try {
      await fetch(`/api/reports/${id}`, { method: "DELETE" });
      fetchReports();
      fetchScheduled();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartExport = async (type) => {
    try {
      await fetch("/api/exports/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, format: "csv" }),
      });
      fetchExportJobs();
    } catch (e) {
      console.error(e);
    }
  };

  const availableMetrics = [
    { id: "messages_sent", label: "Messages Sent" },
    { id: "leads_generated", label: "Leads Generated" },
    { id: "conversion_rate", label: "Conversion Rate" },
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
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <MdBarChart className="text-blue-600 mr-3" size={24} />
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {reports.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Reports</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <MdSchedule className="text-green-600 mr-3" size={24} />
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {scheduledReports.length}
                  </div>
                  <div className="text-sm text-gray-600">Scheduled</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <MdFileDownload className="text-purple-600 mr-3" size={24} />
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {exportJobs.filter((j) => j.status === "completed").length}
                  </div>
                  <div className="text-sm text-gray-600">Exports Complete</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <MdTrendingUp className="text-orange-600 mr-3" size={24} />
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {reports.filter((r) => r.last_generated).length}
                  </div>
                  <div className="text-sm text-gray-600">Reports Generated</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowReportBuilder(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition-colors"
              >
                <MdAdd className="mr-2" size={20} />
                Create Report
              </button>
              <button
                onClick={() => {
                  fetchReports();
                  fetchScheduled();
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center transition-colors"
              >
                <MdRefresh className="mr-2" size={16} />
                Refresh
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Reports Table */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
            </div>

            {reports.length === 0 ? (
              <div className="p-8 text-center">
                <MdBarChart className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Reports Yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first report to track your DM performance
                </p>
                <button
                  onClick={() => setShowReportBuilder(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create Your First Report
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Report
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Metrics
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Schedule
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Last Generated
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {r.name}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center space-x-2">
                              <span className="capitalize">{r.type}</span>
                              <span>•</span>
                              <span>{r.date_range?.replace("_", " ")}</span>
                              <span>•</span>
                              <span className="uppercase">{r.format}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.metrics?.slice(0, 2).map((metric) => (
                              <span
                                key={metric}
                                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium"
                              >
                                {availableMetrics.find((m) => m.id === metric)
                                  ?.label || metric}
                              </span>
                            ))}
                            {r.metrics?.length > 2 && (
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                +{r.metrics.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            {r.schedule_frequency === "manual" ? (
                              <span className="text-gray-500">Manual</span>
                            ) : (
                              <>
                                <MdSchedule
                                  size={14}
                                  className="text-blue-600"
                                />
                                <span className="text-gray-700 capitalize">
                                  {r.schedule_frequency}
                                </span>
                                {r.schedule_time && (
                                  <span className="text-gray-500 text-xs">
                                    @ {r.schedule_time}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {r.last_generated
                            ? new Date(r.last_generated).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRunReport(r.id)}
                              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                              title="Run Report"
                            >
                              <MdPlayArrow size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handleExportReport(r.id, r.format || "csv")
                              }
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                              title="Export Report"
                            >
                              <MdFileDownload size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteReport(r.id)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Delete Report"
                            >
                              <MdDelete size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Builder Tab */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Advanced Report Builder
            </h2>

            {/* Quick Templates */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-700 mb-3">
                Quick Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    name: "DM Performance Report",
                    metrics: [
                      "messages_sent",
                      "leads_generated",
                      "conversion_rate",
                    ],
                    type: "standard",
                    dateRange: "last_30_days",
                  },
                  {
                    name: "Lead Generation Summary",
                    metrics: ["leads_generated"],
                    type: "summary",
                    dateRange: "last_7_days",
                  },
                  {
                    name: "Monthly Analytics",
                    metrics: [
                      "messages_sent",
                      "leads_generated",
                      "conversion_rate",
                    ],
                    type: "detailed",
                    dateRange: "last_30_days",
                  },
                ].map((template, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setReportConfig({
                        ...reportConfig,
                        name: template.name,
                        metrics: template.metrics,
                        type: template.type,
                        dateRange: template.dateRange,
                      });
                      setShowReportBuilder(true);
                    }}
                  >
                    <h4 className="font-medium text-gray-900 mb-2">
                      {template.name}
                    </h4>
                    <div className="text-sm text-gray-600 mb-2">
                      {template.metrics.length} metrics •{" "}
                      {template.dateRange.replace("_", " ")}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {template.metrics.slice(0, 2).map((metric) => (
                        <span
                          key={metric}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                        >
                          {availableMetrics.find((m) => m.id === metric)
                            ?.label || metric}
                        </span>
                      ))}
                      {template.metrics.length > 2 && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                          +{template.metrics.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced Options */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">
                  Available Metrics
                </h3>
                <div className="space-y-2">
                  {availableMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {metric.label}
                        </div>
                        <div className="text-sm text-gray-600">
                          Track {metric.label.toLowerCase()}
                        </div>
                      </div>
                      <MdBarChart className="text-blue-600" size={20} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">
                  Export Formats
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      id: "csv",
                      label: "CSV",
                      desc: "Comma-separated values for spreadsheets",
                    },
                    {
                      id: "json",
                      label: "JSON",
                      desc: "Machine-readable data format",
                    },
                    {
                      id: "excel",
                      label: "Excel",
                      desc: "Microsoft Excel format",
                    },
                  ].map((format) => (
                    <div
                      key={format.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {format.label}
                        </div>
                        <div className="text-sm text-gray-600">
                          {format.desc}
                        </div>
                      </div>
                      <MdFileDownload className="text-green-600" size={20} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Report Button */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowReportBuilder(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
              >
                <MdAdd className="mr-2" size={20} />
                Create Custom Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === "scheduled" && (
        <div className="space-y-6">
          {/* Scheduled Reports Overview */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Scheduled Reports
                </h2>
                <div className="flex items-center space-x-2">
                  <MdSchedule className="text-blue-600" size={20} />
                  <span className="text-sm text-gray-600">
                    {scheduledReports.length} scheduled
                  </span>
                </div>
              </div>
            </div>

            {scheduledReports.length === 0 ? (
              <div className="p-8 text-center">
                <MdSchedule className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Scheduled Reports
                </h3>
                <p className="text-gray-600 mb-4">
                  Create automated reports that run on your schedule
                </p>
                <button
                  onClick={() => setShowReportBuilder(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create Scheduled Report
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {scheduledReports.map((report) => (
                  <div key={report.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {report.name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center">
                            <MdAccessTime className="mr-1" size={14} />
                            {report.schedule_frequency} at{" "}
                            {report.schedule_time}
                          </span>
                          {report.schedule_days &&
                            report.schedule_days.length > 0 && (
                              <span>
                                Days:{" "}
                                {report.schedule_days
                                  .map(
                                    (day) =>
                                      [
                                        "Sun",
                                        "Mon",
                                        "Tue",
                                        "Wed",
                                        "Thu",
                                        "Fri",
                                        "Sat",
                                      ][day]
                                  )
                                  .join(", ")}
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            report.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {report.status}
                        </span>
                        <button
                          onClick={() => handleRunReport(report.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Run Now"
                        >
                          <MdPlayArrow size={20} />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <MdDelete size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Type:</span>
                          <div className="font-medium">{report.type}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Date Range:</span>
                          <div className="font-medium">{report.date_range}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Format:</span>
                          <div className="font-medium uppercase">
                            {report.format}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Next Run:</span>
                          <div className="font-medium">
                            {report.next_run
                              ? new Date(report.next_run).toLocaleDateString()
                              : "—"}
                          </div>
                        </div>
                      </div>

                      {report.metrics && report.metrics.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-gray-500 text-sm">
                            Metrics:
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {report.metrics.map((metric) => (
                              <span
                                key={metric}
                                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium"
                              >
                                {availableMetrics.find((m) => m.id === metric)
                                  ?.label || metric}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.last_generated && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-sm text-gray-600">
                          Last generated:{" "}
                          {new Date(report.last_generated).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                icon: MdTrendingUp,
                desc: "All lead data",
              },
              {
                type: "messages",
                label: "Export Messages",
                icon: MdEmail,
                desc: "Message history",
              },
              {
                type: "analytics",
                label: "Export Analytics",
                icon: MdBarChart,
                desc: "Performance metrics",
              },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <div
                  key={opt.type}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center mb-4">
                    <Icon className="text-blue-600 mr-3" size={24} />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {opt.label}
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-4">{opt.desc}</p>
                  <button
                    onClick={() => handleStartExport(opt.type)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Start Export
                  </button>
                </div>
              );
            })}
          </div>

          {/* Export Jobs */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Export Jobs
                </h2>
                <button
                  onClick={fetchExportJobs}
                  className="text-gray-500 hover:text-gray-700"
                  title="Refresh"
                >
                  <MdRefresh size={20} />
                </button>
              </div>
            </div>

            {exportJobs.length === 0 ? (
              <div className="p-8 text-center">
                <MdFileDownload
                  className="mx-auto text-gray-400 mb-4"
                  size={48}
                />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Export Jobs
                </h3>
                <p className="text-gray-600">
                  Start an export to see the progress here
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {exportJobs.map((job) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            job.status === "completed"
                              ? "bg-green-500"
                              : job.status === "processing"
                                ? "bg-blue-500 animate-pulse"
                                : job.status === "error"
                                  ? "bg-red-500"
                                  : "bg-gray-400"
                          }`}
                        ></div>
                        <div>
                          <h3 className="font-medium text-gray-900 capitalize">
                            {job.type} Export
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>Job #{job.id}</span>
                            <span>•</span>
                            <span>{job.format?.toUpperCase()}</span>
                            {job.record_count && (
                              <>
                                <span>•</span>
                                <span>{job.record_count} records</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                          job.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : job.status === "processing"
                              ? "bg-blue-100 text-blue-800"
                              : job.status === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    {/* Progress Bar for Processing Jobs */}
                    {job.status === "processing" && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
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

                    {/* Error Message */}
                    {job.status === "error" && job.error && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-sm text-red-700">
                          <strong>Error:</strong> {job.error}
                        </div>
                      </div>
                    )}

                    {/* Job Details and Actions */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-600">
                        Created: {new Date(job.created_at).toLocaleString()}
                        {job.completed_at && (
                          <span className="ml-4">
                            Completed:{" "}
                            {new Date(job.completed_at).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {job.status === "completed" && job.file_path && (
                        <a
                          href={`/api/exports/jobs/${job.id}/download`}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <MdFileDownload className="mr-1" size={16} />
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Builder Modal */}
      {showReportBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Create Report</h2>
            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Name
                </label>
                <input
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter report name"
                  value={reportConfig.name}
                  onChange={(e) =>
                    setReportConfig({ ...reportConfig, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type
                  </label>
                  <select
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={reportConfig.type}
                    onChange={(e) =>
                      setReportConfig({ ...reportConfig, type: e.target.value })
                    }
                  >
                    <option value="standard">Standard</option>
                    <option value="summary">Summary</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Range
                  </label>
                  <select
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={reportConfig.dateRange}
                    onChange={(e) =>
                      setReportConfig({
                        ...reportConfig,
                        dateRange: e.target.value,
                      })
                    }
                  >
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="last_90_days">Last 90 Days</option>
                  </select>
                </div>
              </div>

              {/* Metrics Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metrics to Include
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {availableMetrics.map((m) => (
                    <label key={m.id} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={reportConfig.metrics.includes(m.id)}
                        onChange={(e) => {
                          setReportConfig({
                            ...reportConfig,
                            metrics: e.target.checked
                              ? [...reportConfig.metrics, m.id]
                              : reportConfig.metrics.filter((x) => x !== m.id),
                          });
                        }}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Format and Visualization */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visualization
                  </label>
                  <select
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={reportConfig.visualization}
                    onChange={(e) =>
                      setReportConfig({
                        ...reportConfig,
                        visualization: e.target.value,
                      })
                    }
                  >
                    <option value="table">Table</option>
                    <option value="chart">Chart</option>
                    <option value="dashboard">Dashboard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Export Format
                  </label>
                  <select
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={reportConfig.format}
                    onChange={(e) =>
                      setReportConfig({
                        ...reportConfig,
                        format: e.target.value,
                      })
                    }
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
              </div>

              {/* Scheduling Options */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Frequency
                    </label>
                    <select
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={reportConfig.schedule.frequency}
                      onChange={(e) =>
                        setReportConfig({
                          ...reportConfig,
                          schedule: {
                            ...reportConfig.schedule,
                            frequency: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="manual">Manual</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {reportConfig.schedule.frequency !== "manual" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Time
                        </label>
                        <input
                          type="time"
                          className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={reportConfig.schedule.time}
                          onChange={(e) =>
                            setReportConfig({
                              ...reportConfig,
                              schedule: {
                                ...reportConfig.schedule,
                                time: e.target.value,
                              },
                            })
                          }
                        />
                      </div>

                      {reportConfig.schedule.frequency === "weekly" && (
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            Days of Week
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "Sunday",
                              "Monday",
                              "Tuesday",
                              "Wednesday",
                              "Thursday",
                              "Friday",
                              "Saturday",
                            ].map((day, index) => (
                              <label
                                key={day}
                                className="flex items-center text-sm"
                              >
                                <input
                                  type="checkbox"
                                  className="mr-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  checked={reportConfig.schedule.days.includes(
                                    index
                                  )}
                                  onChange={(e) => {
                                    const days = e.target.checked
                                      ? [...reportConfig.schedule.days, index]
                                      : reportConfig.schedule.days.filter(
                                          (d) => d !== index
                                        );
                                    setReportConfig({
                                      ...reportConfig,
                                      schedule: {
                                        ...reportConfig.schedule,
                                        days,
                                      },
                                    });
                                  }}
                                />
                                {day.substring(0, 3)}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowReportBuilder(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={
                    !reportConfig.name ||
                    reportConfig.metrics.length === 0 ||
                    loading
                  }
                  onClick={handleCreateReport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
