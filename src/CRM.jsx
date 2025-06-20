import React, { useState, useEffect, useCallback } from "react";
import {
  FaAddressBook,
  FaUser,
  FaTag,
  FaPlus,
  FaFilter,
  FaEdit,
  FaTrash,
  FaComments,
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaSearch,
} from "react-icons/fa";

const CRM = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    username: "",
    email: "",
    phone: "",
    status: "lead",
  });

  const statusOptions = [
    { value: "lead", label: "Lead", color: "blue" },
    { value: "prospect", label: "Prospect", color: "yellow" },
    { value: "customer", label: "Customer", color: "green" },
    { value: "inactive", label: "Inactive", color: "gray" },
  ];

  const statusColors = {
    lead: "bg-blue-100 text-blue-800 border-blue-200",
    prospect: "bg-yellow-100 text-yellow-800 border-yellow-200",
    customer: "bg-green-100 text-green-800 border-green-200",
    inactive: "bg-gray-100 text-gray-800 border-gray-200",
  };

  useEffect(() => {
    fetchContacts();
  }, [filterStatus, filterTag]);

  const fetchContacts = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus) queryParams.append("status", filterStatus);
      if (filterTag) queryParams.append("tag", filterTag);

      const response = await fetch(`/api/crm/contacts?${queryParams}`);
      const data = await response.json();
      if (data.status === "success") {
        setContacts(data.contacts || []);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError("Failed to fetch contacts");
      // Mock data for demo
      setContacts([
        {
          id: 1,
          username: "john_doe",
          email: "john@example.com",
          phone: "+1234567890",
          status: "lead",
          tags: ["fitness", "entrepreneur"],
          notes: ["Initial contact made", "Interested in fitness products"],
          last_interaction: "2024-01-15",
          created_at: "2024-01-10",
        },
        {
          id: 2,
          username: "jane_smith",
          email: "jane@example.com",
          phone: "+1234567891",
          status: "customer",
          tags: ["business", "marketing"],
          notes: ["Purchased product", "Very satisfied customer"],
          last_interaction: "2024-01-20",
          created_at: "2024-01-05",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    if (!newContact.username.trim()) return;

    try {
      const response = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });

      const data = await response.json();
      if (data.status === "success") {
        fetchContacts();
        setNewContact({ username: "", email: "", phone: "", status: "lead" });
        setShowAddContact(false);
      }
    } catch (error) {
      console.error("Failed to add contact:", error);
    }
  };

  const updateContactStatus = async (contactId, newStatus) => {
    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchContacts();
        if (selectedContact && selectedContact.id === contactId) {
          setSelectedContact({ ...selectedContact, status: newStatus });
        }
      }
    } catch (error) {
      console.error("Failed to update contact:", error);
    }
  };

  const addNote = async () => {
    if (!selectedContact || !newNote.trim()) return;

    try {
      const response = await fetch(
        `/api/crm/contacts/${selectedContact.id}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: newNote }),
        }
      );

      if (response.ok) {
        const updatedContact = {
          ...selectedContact,
          notes: [...(selectedContact.notes || []), newNote],
        };
        setSelectedContact(updatedContact);
        setNewNote("");
        fetchContacts();
      }
    } catch (error) {
      console.error("Failed to add note:", error);
    }
  };

  const handleSearchTermChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleFilterStatusChange = useCallback((e) => {
    setFilterStatus(e.target.value);
  }, []);

  const handleFilterTagChange = useCallback((e) => {
    setFilterTag(e.target.value);
  }, []);

  const handleNewNoteChange = useCallback((e) => {
    setNewNote(e.target.value);
  }, []);

  const handleNewContactChange = useCallback((field, value) => {
    setNewContact((prev) => ({ ...prev, [field]: value }));
  }, []);

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-black flex items-center">
            <FaAddressBook className="mr-3 text-indigo-600" />
            Customer Relationship Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your leads, prospects, and customers
          </p>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contacts List */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-black flex items-center">
                    <FaUser className="mr-2 text-blue-600" />
                    Contacts ({filteredContacts.length})
                  </h2>

                  <button
                    onClick={() => setShowAddContact(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                  >
                    <FaPlus className="mr-2" />
                    Add Contact
                  </button>
                </div>

                {/* Filters and Search */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchTermChange}
                      placeholder="Search contacts..."
                      className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                    />
                  </div>

                  <select
                    value={filterStatus}
                    onChange={handleFilterStatusChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                  >
                    <option value="">All Statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={filterTag}
                    onChange={handleFilterTagChange}
                    placeholder="Filter by tag..."
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                  />
                </div>

                {/* Contacts Grid */}
                {loading ? (
                  <div className="text-center py-12 text-gray-500">
                    Loading contacts...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FaUser className="mx-auto text-4xl mb-4" />
                    <p className="text-lg">No contacts found</p>
                    <p className="text-sm">Add some contacts to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedContact?.id === contact.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                              {contact.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-black">
                                @{contact.username}
                              </p>
                              <p className="text-sm text-gray-600">
                                {contact.email}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-xs border ${statusColors[contact.status]}`}
                            >
                              {
                                statusOptions.find(
                                  (s) => s.value === contact.status
                                )?.label
                              }
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              Last:{" "}
                              {contact.last_interaction
                                ? new Date(
                                    contact.last_interaction
                                  ).toLocaleDateString()
                                : "Never"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contact Details */}
            <div className="lg:col-span-1">
              {selectedContact ? (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      {selectedContact.username.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-lg font-semibold text-black">
                      @{selectedContact.username}
                    </h3>
                    <p className="text-gray-600">{selectedContact.email}</p>
                  </div>

                  {/* Status Update */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={selectedContact.status}
                      onChange={(e) =>
                        updateContactStatus(selectedContact.id, e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 mb-6">
                    {selectedContact.phone && (
                      <div className="flex items-center text-sm">
                        <FaPhone className="mr-2 text-gray-500" />
                        <span className="text-black">
                          {selectedContact.phone}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <FaCalendarAlt className="mr-2 text-gray-500" />
                      <span className="text-black">
                        Added:{" "}
                        {new Date(
                          selectedContact.created_at
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedContact.tags && selectedContact.tags.length > 0 && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {selectedContact.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                      {" "}
                      {selectedContact.notes &&
                      selectedContact.notes.length > 0 ? (
                        selectedContact.notes.map((note, index) => (
                          <div
                            key={index}
                            className="bg-gray-50 p-2 rounded text-sm text-black"
                          >
                            {typeof note === "string"
                              ? note
                              : note?.content || note}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No notes yet</p>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newNote}
                        onChange={handleNewNoteChange}
                        placeholder="Add a note..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black text-sm"
                        onKeyPress={(e) => e.key === "Enter" && addNote()}
                      />
                      <button
                        onClick={addNote}
                        disabled={!newNote.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <FaPlus />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <FaUser className="mx-auto text-4xl text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    Select a contact to view details
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Add Contact Modal */}
          {showAddContact && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="text-lg font-semibold mb-4">Add New Contact</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newContact.username}
                    onChange={(e) =>
                      handleNewContactChange("username", e.target.value)
                    }
                    placeholder="Instagram username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                  />
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) =>
                      handleNewContactChange("email", e.target.value)
                    }
                    placeholder="Email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                  />
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) =>
                      handleNewContactChange("phone", e.target.value)
                    }
                    placeholder="Phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                  />
                  <select
                    value={newContact.status}
                    onChange={(e) =>
                      handleNewContactChange("status", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-black"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAddContact(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addContact}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add Contact
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRM;
