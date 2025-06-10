import React, { useState, useEffect } from "react";
import {
  FaChartLine,
  FaUsers,
  FaEnvelope,
  FaReply,
  FaEye,
  FaArrowUp,
  FaCalendarAlt,
  FaFilter,
  FaDownload,
} from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const Analytics = () => {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedMetric, setSelectedMetric] = useState("messages");
  const [analytics, setAnalytics] = useState({
    totalMessages: 0,
    totalReplies: 0,
    totalViews: 0,
    activeAccounts: 0,
    replyRate: 0,
    viewRate: 0,
    dailyStats: [],
    accountStats: [],
    campaignStats: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);
  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/analytics?range=${timeRange}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.status === "success") {
          setAnalytics(result.data);
        }
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const statCards = [
    {
      title: "Total Messages",
      value: analytics.totalMessages?.toLocaleString() || 0,
      icon: FaEnvelope,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      change: "+12%",
      trend: "up",
    },
    {
      title: "Total Replies",
      value: analytics.totalReplies?.toLocaleString() || 0,
      icon: FaReply,
      color: "text-green-600",
      bgColor: "bg-green-50",
      change: "+8%",
      trend: "up",
    },
    {
      title: "Message Views",
      value: analytics.totalViews?.toLocaleString() || 0,
      icon: FaEye,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      change: "+15%",
      trend: "up",
    },
    {
      title: "Active Accounts",
      value: analytics.activeAccounts || 0,
      icon: FaUsers,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      change: "+3%",
      trend: "up",
    },
  ];

  const performanceCards = [
    {
      title: "Reply Rate",
      value: `${(analytics.replyRate || 0).toFixed(1)}%`,
      description: "Average response rate",
      color: "text-green-600",
    },
    {
      title: "View Rate",
      value: `${(analytics.viewRate || 0).toFixed(1)}%`,
      description: "Message open rate",
      color: "text-blue-600",
    },
    {
      title: "Avg Response Time",
      value: "2.4h",
      description: "Time to first reply",
      color: "text-purple-600",
    },
  ];

  const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-gray-600">
              Track your Instagram DM automation performance
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-0">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <FaDownload />
              Export Report
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
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
                  <div className="flex items-center gap-1 mt-2">
                    <FaArrowUp className="text-green-500 text-xs" />
                    <span className="text-sm text-green-600">
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500">
                      vs last period
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`text-xl ${stat.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {performanceCards.map((metric, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {metric.title}
              </h3>
              <p className={`text-3xl font-bold ${metric.color} mb-1`}>
                {metric.value}
              </p>
              <p className="text-sm text-gray-600">{metric.description}</p>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Messages Over Time */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Messages Sent Over Time
              </h3>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="messages">Messages Sent</option>
                <option value="replies">Replies Received</option>
                <option value="views">Message Views</option>
              </select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={selectedMetric}
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#3B82F6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Account Performance */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Account Performance
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.accountStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="account" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="messages"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Campaign Distribution */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Campaign Distribution
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.campaignStats}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="messages"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {analytics.campaignStats?.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Recent Activity
            </h3>
            <div className="space-y-4">
              {[
                {
                  action: "Message sent",
                  account: "@account1",
                  time: "2 minutes ago",
                  status: "success",
                },
                {
                  action: "Reply received",
                  account: "@account2",
                  time: "15 minutes ago",
                  status: "success",
                },
                {
                  action: "Campaign started",
                  account: "@account3",
                  time: "1 hour ago",
                  status: "info",
                },
                {
                  action: "Account connected",
                  account: "@account4",
                  time: "2 hours ago",
                  status: "success",
                },
                {
                  action: "Rate limit hit",
                  account: "@account1",
                  time: "3 hours ago",
                  status: "warning",
                },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activity.status === "success"
                          ? "bg-green-500"
                          : activity.status === "warning"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.account}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
