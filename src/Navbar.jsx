import React from "react";
import {
  MdSendToMobile,
  MdAccountCircle,
  MdDashboard,
  MdAssessment,
  MdGroup,
} from "react-icons/md";
import {
  FaCompass,
} from "react-icons/fa6";
import { FaUserFriends, FaBolt } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();
  const navigationItems = [
    { path: "/", icon: MdDashboard, text: "Dashboard", size: 24 },
    { path: "/messaging", icon: MdSendToMobile, text: "Messaging", size: 24 },
    { path: "/leads", icon: FaCompass, text: "Leads & Targeting", size: 22 },
    {
      path: "/accounts",
      icon: MdAccountCircle,
      text: "Accounts & Safety",
      size: 24,
    },
    { path: "/crm", icon: FaUserFriends, text: "CRM", size: 22 },
    { path: "/reports", icon: MdAssessment, text: "Reports", size: 24 },
    { path: "/team", icon: MdGroup, text: "Team", size: 24 },
  ];
  return (
    <nav className="fixed top-0 left-0 h-screen w-20 bg-black border-r border-gray-800 flex flex-col items-center py-4 z-50">
      {/* Logo/Brand */}
      <div className="relative flex items-center justify-center w-12 h-12 mb-3 cursor-pointer rounded-2xl transition-all duration-200 bg-green-500 hover:bg-green-400 hover:rounded-xl group">
        <FaBolt size={20} className="text-black" />
        <span className="absolute left-16 px-3 py-2 ml-2 text-sm font-medium text-white bg-gray-900 rounded-md opacity-0 pointer-events-none transition-opacity duration-200 z-50 group-hover:opacity-100 whitespace-nowrap">
          InstaDM Pro
        </span>
      </div>

      {/* Divider */}
      <div className="w-8 h-px my-2 bg-gray-800"></div>

      {/* Scrollable Navigation Items */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path === "/messaging" &&
              (location.pathname === "/send-dm" ||
                location.pathname === "/schedule-dm")) ||
            (item.path === "/accounts" && location.pathname === "/safety") ||
            (item.path === "/leads" && location.pathname === "/targeting");

          return (
            <Link key={item.path} to={item.path}>
              <div
                className={`relative flex items-center justify-center w-12 h-12 mb-3 cursor-pointer rounded-2xl transition-all duration-200 group ${
                  isActive
                    ? "bg-green-500 text-black rounded-xl"
                    : "bg-gray-900 text-gray-400 hover:bg-green-500 hover:text-black hover:rounded-xl"
                }`}
              >
                <Icon size={item.size} />{" "}
                <span className="absolute left-16 px-3 py-2 ml-2 text-sm font-medium text-white bg-gray-900 rounded-md opacity-0 pointer-events-none transition-opacity duration-200 z-50 group-hover:opacity-100 whitespace-nowrap">
                  {item.text}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
