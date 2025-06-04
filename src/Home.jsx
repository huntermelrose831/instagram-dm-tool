import React from "react";
import { Link } from "react-router-dom";

const Home = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">Welcome to InstaDM Automation</h1>
    <p className="mb-6 text-lg text-gray-700">
      Choose an option below to get started:
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Link to="/send-dm">
        <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
          <h2 className="text-xl font-semibold mb-2">Send DMs</h2>
          <p>Automate direct messages to your target users.</p>
        </div>
      </Link>

      <Link to="/targets">
        <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
          <h2 className="text-xl font-semibold mb-2">Targets</h2>
          <p>Manage your target lists and add new usernames.</p>
        </div>
      </Link>

      <Link to="/leads">
        <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
          <h2 className="text-xl font-semibold mb-2">Find Leads</h2>
          <p>Discover leads by Instagram post URL and more coming soon.</p>
        </div>
      </Link>

      <Link to="/accounts">
        <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
          <h2 className="text-xl font-semibold mb-2">Accounts</h2>
          <p>Manage multiple Instagram accounts and stay signed in.</p>
        </div>
      </Link>
    </div>
  </div>
);

export default Home;
