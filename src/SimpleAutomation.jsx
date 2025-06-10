import React from "react";

const SimpleAutomation = () => {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Smart Automation</h1>
          <div className="ml-4 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            Active
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Auto Responders
            </h3>
            <p className="text-gray-600 text-sm">
              Automatically respond to incoming messages based on triggers
            </p>
            <div className="mt-4">
              <div className="text-2xl font-bold text-blue-600">5</div>
              <div className="text-sm text-gray-500">Active Rules</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Follow-up Sequences
            </h3>
            <p className="text-gray-600 text-sm">
              Create automated follow-up message sequences
            </p>
            <div className="mt-4">
              <div className="text-2xl font-bold text-purple-600">3</div>
              <div className="text-sm text-gray-500">Active Sequences</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Performance
            </h3>
            <p className="text-gray-600 text-sm">
              Track automation performance and metrics
            </p>
            <div className="mt-4">
              <div className="text-2xl font-bold text-green-600">87%</div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Automation Activity
            </h2>
          </div>
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              Smart Automation component is loading successfully!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleAutomation;
