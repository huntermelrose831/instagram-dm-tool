import React, { useState, useEffect } from "react";
import {
  FaSearch,
  FaFilter,
  FaReply,
  FaUser,
  FaCheck,
  FaCheckDouble,
  FaClock,
  FaArchive,
  FaStar,
  FaTag,
  FaEllipsisV,
  FaPaperPlane,
  FaRobot,
  FaUserCheck,
} from "react-icons/fa";

const Inbox = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [filterStatus]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/inbox/conversations?status=${filterStatus}&search=${searchTerm}`
      );
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/inbox/conversations/${conversationId}/messages`
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/inbox/conversations/${selectedConversation.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: newMessage }),
        }
      );

      if (response.ok) {
        setNewMessage("");
        fetchMessages(selectedConversation.id);
        fetchConversations(); // Refresh conversation list
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await fetch(
        `http://localhost:5000/api/inbox/conversations/${conversationId}/mark-read`,
        { method: "PATCH" }
      );
      fetchConversations();
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const updateConversationStatus = async (conversationId, status) => {
    try {
      await fetch(
        `http://localhost:5000/api/inbox/conversations/${conversationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      fetchConversations();
    } catch (error) {
      console.error("Error updating conversation status:", error);
    }
  };

  const addTag = async (conversationId, tag) => {
    try {
      await fetch(
        `http://localhost:5000/api/inbox/conversations/${conversationId}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag }),
        }
      );
      fetchConversations();
    } catch (error) {
      console.error("Error adding tag:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "unread":
        return "bg-red-100 text-red-800";
      case "read":
        return "bg-blue-100 text-blue-800";
      case "replied":
        return "bg-green-100 text-green-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      case "starred":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "unread":
        return <FaClock className="text-red-500" />;
      case "read":
        return <FaCheck className="text-blue-500" />;
      case "replied":
        return <FaCheckDouble className="text-green-500" />;
      case "archived":
        return <FaArchive className="text-gray-500" />;
      case "starred":
        return <FaStar className="text-yellow-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen bg-white flex">
      {/* Conversations Sidebar */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <FaFilter />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              {["all", "unread", "read", "replied", "starred", "archived"].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      filterStatus === status
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => {
                setSelectedConversation(conversation);
                if (conversation.status === "unread") {
                  markAsRead(conversation.id);
                }
              }}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConversation?.id === conversation.id
                  ? "bg-blue-50 border-blue-200"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {conversation.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    {conversation.status === "unread" && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        @{conversation.username || "Unknown"}
                      </p>
                      {getStatusIcon(conversation.status)}
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.lastMessage || "No messages yet"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">
                        {conversation.lastActivity
                          ? new Date(
                              conversation.lastActivity
                            ).toLocaleDateString()
                          : ""}
                      </span>
                      {conversation.campaign && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {conversation.campaign}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                      conversation.status
                    )}`}
                  >
                    {conversation.status}
                  </span>
                  {conversation.tags && conversation.tags.length > 0 && (
                    <div className="flex gap-1">
                      {conversation.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-blue-100 text-blue-600 px-1 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <FaUser className="mx-auto text-4xl mb-4" />
              <p>No conversations found</p>
            </div>
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation.username?.charAt(0).toUpperCase() ||
                      "?"}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      @{selectedConversation.username || "Unknown"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.campaign && (
                        <span>Campaign: {selectedConversation.campaign}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateConversationStatus(
                        selectedConversation.id,
                        selectedConversation.status === "starred"
                          ? "read"
                          : "starred"
                      )
                    }
                    className={`p-2 rounded-lg ${
                      selectedConversation.status === "starred"
                        ? "text-yellow-500 bg-yellow-50"
                        : "text-gray-500 hover:text-yellow-500 hover:bg-yellow-50"
                    }`}
                  >
                    <FaStar />
                  </button>
                  <button
                    onClick={() =>
                      updateConversationStatus(
                        selectedConversation.id,
                        "archived"
                      )
                    }
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <FaArchive />
                  </button>
                  <button
                    onClick={() => addTag(selectedConversation.id, "important")}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <FaTag />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.isOutgoing ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isOutgoing
                          ? "bg-blue-500 text-white"
                          : "bg-white text-gray-900 border border-gray-200"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs opacity-70">
                          {message.createdAt
                            ? new Date(message.createdAt).toLocaleTimeString()
                            : ""}
                        </span>
                        {message.isOutgoing && (
                          <div className="flex items-center gap-1">
                            {message.isRead ? (
                              <FaCheckDouble className="text-xs" />
                            ) : (
                              <FaCheck className="text-xs" />
                            )}
                          </div>
                        )}
                        {message.isAutomated && (
                          <FaRobot
                            className="text-xs"
                            title="Automated message"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !newMessage.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FaPaperPlane />
                  {isLoading ? "Sending..." : "Send"}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-2">
                <button className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">
                  Quick Reply
                </button>
                <button className="text-xs px-3 py-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200">
                  Follow Up
                </button>
                <button className="text-xs px-3 py-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200">
                  Add to CRM
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FaReply className="mx-auto text-6xl text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
