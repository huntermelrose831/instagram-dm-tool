import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaEnvelope,
  FaUsers,
  FaSearch,
  FaUserFriends,
  FaRocket,
  FaChartLine,
  FaArrowRight,
  FaPlay,
} from "react-icons/fa";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

const Home = () => {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [accountsRes, targetsRes, contactsRes, reportsRes] =
          await Promise.all([
            fetch(`${API_BASE_URL}/api/accounts`),
            fetch(`${API_BASE_URL}/api/targets`),
            fetch(`${API_BASE_URL}/api/crm/contacts`),
            fetch(`${API_BASE_URL}/api/reports/stats`),
          ]);
        const [accounts, targetsData, crmData, reportStats] = await Promise.all(
          [
            accountsRes.json(),
            targetsRes.json(),
            contactsRes.json(),
            reportsRes.json(),
          ],
        );
        setStats({
          accounts: Array.isArray(accounts) ? accounts.length : 0,
          targets: (targetsData.targets || []).length,
          contacts: (crmData.contacts || []).length,
          dmsSent: reportStats.total || 0,
        });
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);
  const features = [
    {
      to: "/send-dm",
      icon: FaEnvelope,
      title: "Send DMs",
      description:
        "Automate direct messages to your target users with smart rate limiting.",
      color: "green",
    },
    {
      to: "/targets",
      icon: FaUsers,
      title: "Targets",
      description:
        "Manage your target lists and add new usernames for outreach.",
      color: "blue",
    },
    {
      to: "/leads",
      icon: FaSearch,
      title: "Find Leads",
      description:
        "Discover leads by Instagram post URL and advanced search criteria.",
      color: "purple",
    },
    {
      to: "/accounts",
      icon: FaUserFriends,
      title: "Accounts",
      description: "Manage multiple Instagram accounts and stay authenticated.",
      color: "yellow",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Hero Section */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="px-8 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              TurboDM
            </h1>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Scale your Instagram outreach with intelligent automation and
              advanced targeting. Built for modern marketers and growth hackers.
            </p>
            <div className="flex justify-center">
              <Link
                to="/send-dm"
                className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg font-semibold transition-colors flex items-center text-white"
              >
                <FaPlay className="mr-2" />
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-black mb-4">
              Instagram Outreach Made Simple
            </h2>
            <p className="text-gray-600 text-lg">
              Powerful tools to automate and optimize your Instagram outreach
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Link key={index} to={feature.to}>
                  <div className="bg-white border border-gray-200 rounded-xl p-6 h-full transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-gray-300 group cursor-pointer">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-${feature.color}-100`}>
                        <Icon className={`text-xl text-${feature.color}-600`} />
                      </div>
                      <FaArrowRight className="text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </div>

                    <h3 className="text-xl font-semibold text-black mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="px-8 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {statsLoading ? "…" : (stats?.dmsSent ?? 0)}
                </div>
                <div className="text-gray-600">DMs Sent</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {statsLoading ? "…" : (stats?.targets ?? 0)}
                </div>
                <div className="text-gray-600">Targets</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {statsLoading ? "…" : (stats?.contacts ?? 0)}
                </div>
                <div className="text-gray-600">CRM Contacts</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-yellow-600 mb-2">
                  {statsLoading ? "…" : (stats?.accounts ?? 0)}
                </div>
                <div className="text-gray-600">Accounts</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
