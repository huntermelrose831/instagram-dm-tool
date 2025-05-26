import React from "react";

const Home = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">Welcome to InstaDM Automation</h1>
    <p className="mb-6 text-lg text-gray-700">
      Choose an option below to get started:
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
        <h2 className="text-xl font-semibold mb-2">Send DMs</h2>
        <p>Automate direct messages to your target users.</p>
      </div>
      <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
        <h2 className="text-xl font-semibold mb-2">Targets</h2>
        <p>Manage your target lists and add new usernames.</p>
      </div>
      <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
        <h2 className="text-xl font-semibold mb-2">Find Leads</h2>
        <p>Discover leads by hashtags, accounts, and more.</p>
      </div>
      <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
        <h2 className="text-xl font-semibold mb-2">Inbox</h2>
        <p>View and manage your Instagram inbox from the app.</p>
      </div>
      <div className="bg-white rounded shadow p-6 hover:shadow-lg transition cursor-pointer">
        <h2 className="text-xl font-semibold mb-2">Accounts</h2>
        <p>Manage multiple Instagram accounts and stay signed in.</p>
      </div>
    </div>
  </div>
);

export default Home;
