import React, { useState, useEffect } from "react";
import {
  MdPeople,
  MdPersonAdd,
  MdEdit,
  MdDelete,
  MdSecurity,
  MdShare,
  MdGroup,
  MdSettings,
  MdNotifications,
  MdHistory,
  MdCheck,
  MdClose,
  MdMoreVert,
  MdAdminPanelSettings,
  MdSupervisorAccount,
  MdPerson,
  MdWork,
} from "react-icons/md";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

const TeamCollaboration = () => {
  const [activeTab, setActiveTab] = useState("members");
  const [teamMembers, setTeamMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [sharedTemplates, setSharedTemplates] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(false);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member",
    workspaces: [],
    message: "",
  });

  // Role form state
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [],
    color: "#3B82F6",
  });

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [membersRes, rolesRes, templatesRes, workspacesRes, activityRes] =
        await Promise.all([
          fetch(`${API_BASE_URL}/api/team/members`),
          fetch(`${API_BASE_URL}/api/team/roles`),
          fetch(`${API_BASE_URL}/api/team/templates`),
          fetch(`${API_BASE_URL}/api/team/workspaces`),
          fetch(`${API_BASE_URL}/api/team/activity`),
        ]);

      const [members, rolesData, templates, workspacesData, activity] =
        await Promise.all([
          membersRes.json(),
          rolesRes.json(),
          templatesRes.json(),
          workspacesRes.json(),
          activityRes.json(),
        ]);

      setTeamMembers(members.members || []);
      setRoles(rolesData.roles || []);
      setSharedTemplates(templates.templates || []);
      setWorkspaces(workspacesData.workspaces || []);
      setActivityLog(activity.activities || []);
    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/team/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        await fetchTeamData();
        setShowInviteModal(false);
        setInviteForm({
          email: "",
          role: "member",
          workspaces: [],
          message: "",
        });
      }
    } catch (error) {
      console.error("Error inviting member:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/team/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm),
      });

      if (response.ok) {
        await fetchTeamData();
        setShowRoleModal(false);
        setRoleForm({
          name: "",
          description: "",
          permissions: [],
          color: "#3B82F6",
        });
      }
    } catch (error) {
      console.error("Error creating role:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberId, newRole) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/team/members/${memberId}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );

      if (response.ok) {
        await fetchTeamData();
      }
    } catch (error) {
      console.error("Error updating member role:", error);
    }
  };

  const availablePermissions = [
    { id: "view_dashboard", label: "View Dashboard", category: "dashboard" },
    { id: "send_messages", label: "Send Messages", category: "messaging" },
    {
      id: "manage_campaigns",
      label: "Manage Campaigns",
      category: "campaigns",
    },
    { id: "view_analytics", label: "View Analytics", category: "analytics" },
    { id: "export_data", label: "Export Data", category: "data" },
    { id: "manage_leads", label: "Manage Leads", category: "leads" },
    { id: "manage_accounts", label: "Manage Accounts", category: "accounts" },
    { id: "team_admin", label: "Team Administration", category: "admin" },
    { id: "billing_access", label: "Billing Access", category: "admin" },
    { id: "api_access", label: "API Access", category: "developer" },
  ];

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return MdAdminPanelSettings;
      case "manager":
        return MdSupervisorAccount;
      default:
        return MdPerson;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "manager":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Team Collaboration
        </h1>
        <p className="text-gray-600">
          Manage team members, roles, permissions, and collaborative workspaces
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: "members", label: "Team Members", icon: MdPeople },
          { id: "roles", label: "Roles & Permissions", icon: MdSecurity },
          { id: "templates", label: "Shared Templates", icon: MdShare },
          { id: "workspaces", label: "Workspaces", icon: MdWork },
          { id: "activity", label: "Activity Log", icon: MdHistory },
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

      {/* Team Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Team Members
              </h2>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                {teamMembers.length} members
              </span>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <MdPersonAdd className="mr-2" size={20} />
              Invite Member
            </button>
          </div>

          {/* Members List */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Last Active
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Workspaces
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {teamMembers.map((member) => {
                    const RoleIcon = getRoleIcon(member.role);
                    return (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                              <span className="text-gray-600 font-medium">
                                {member.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {member.name}
                              </div>
                              <div className="text-gray-500">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(member.role)}`}
                          >
                            <RoleIcon className="mr-1" size={14} />
                            {member.role}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              member.status === "active"
                                ? "bg-green-100 text-green-800"
                                : member.status === "invited"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {member.lastActive || "Never"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {(member.workspaces || []).map((workspace) => (
                              <span
                                key={workspace}
                                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                              >
                                {workspace}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedMember(member)}
                              className="text-gray-600 hover:text-gray-800"
                              title="Edit"
                            >
                              <MdEdit size={16} />
                            </button>
                            <button
                              className="text-red-600 hover:text-red-800"
                              title="Remove"
                            >
                              <MdDelete size={16} />
                            </button>
                            <button
                              className="text-gray-600 hover:text-gray-800"
                              title="More options"
                            >
                              <MdMoreVert size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roles & Permissions Tab */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Roles & Permissions
            </h2>
            <button
              onClick={() => setShowRoleModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <MdSettings className="mr-2" size={20} />
              Create Role
            </button>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: role.color || "#6B7280" }}
                    ></div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {role.name}
                    </h3>
                  </div>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                    {role.memberCount || 0} members
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{role.description}</p>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    Permissions:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 4).map((permissionId) => {
                      const permission = availablePermissions.find(
                        (p) => p.id === permissionId,
                      );
                      return permission ? (
                        <span
                          key={permissionId}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                        >
                          {permission.label}
                        </span>
                      ) : null;
                    })}
                    {role.permissions.length > 4 && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                        +{role.permissions.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-gray-200">
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Shared Templates
          </h2>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Template
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Workspaces
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sharedTemplates.map((template) => (
                    <tr key={template.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <MdShare className="text-gray-400 mr-3" size={20} />
                          <div>
                            <div className="font-medium text-gray-900">
                              {template.name}
                            </div>
                            <div className="text-gray-500 text-xs">
                              Created{" "}
                              {template.created_at || template.createdAt || ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.type === "message"
                              ? "bg-blue-100 text-blue-800"
                              : template.type === "automation"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {template.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {template.created_by || template.createdBy || ""}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {template.usage != null
                          ? `${template.usage} times`
                          : ""}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(template.workspaces || []).map((workspace) => (
                            <span
                              key={workspace}
                              className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs"
                            >
                              {workspace}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            title="Use Template"
                          >
                            <MdShare size={16} />
                          </button>
                          <button
                            className="text-gray-600 hover:text-gray-800"
                            title="Edit"
                          >
                            <MdEdit size={16} />
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

      {/* Activity Log Tab */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Team Activity</h2>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-6 space-y-4">
              {activityLog.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 pb-4 border-b border-gray-100 last:border-b-0"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MdHistory className="text-blue-600" size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user}</span>{" "}
                      {activity.action}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {activity.timestamp}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    action
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Invite Team Member
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <MdClose size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Message (Optional)
                </label>
                <textarea
                  value={inviteForm.message}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, message: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Add a personal message to the invitation"
                />
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteMember}
                  disabled={!inviteForm.email || loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCollaboration;
