import React, { useState, useEffect } from "react";

const CRM = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const statusOptions = ["lead", "prospect", "customer", "inactive"];

  useEffect(() => {
    fetchContacts();
  }, [filterStatus, filterTag]);

  const fetchContacts = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus) queryParams.append("status", filterStatus);
      if (filterTag) queryParams.append("tag", filterTag);

      const response = await fetch(
        `http://localhost:5000/api/crm/contacts?${queryParams}`
      );
      const data = await response.json();
      if (data.status === "success") {
        setContacts(data.contacts);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!selectedContact || !newNote.trim()) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/crm/contacts/${selectedContact.id}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: newNote }),
        }
      );

      const data = await response.json();
      if (data.status === "success") {
        setContacts(
          contacts.map((contact) =>
            contact.id === selectedContact.id
              ? {
                  ...contact,
                  notes: [
                    ...(contact.notes || []),
                    {
                      id: data.noteId,
                      content: newNote,
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : contact
          )
        );
        setNewNote("");
      }
    } catch (error) {
      setError("Failed to add note");
    }
  };

  const updateStatus = async (status) => {
    if (!selectedContact) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/crm/contacts/${selectedContact.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();
      if (data.status === "success") {
        setContacts(
          contacts.map((contact) =>
            contact.id === selectedContact.id ? { ...contact, status } : contact
          )
        );
        setSelectedContact({ ...selectedContact, status });
      }
    } catch (error) {
      setError("Failed to update status");
    }
  };

  const addTag = async () => {
    if (!selectedContact || !newTag.trim()) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/crm/contacts/${selectedContact.id}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag: newTag }),
        }
      );

      const data = await response.json();
      if (data.status === "success") {
        setContacts(
          contacts.map((contact) =>
            contact.id === selectedContact.id
              ? { ...contact, tags: [...(contact.tags || []), newTag] }
              : contact
          )
        );
        setNewTag("");
      }
    } catch (error) {
      setError("Failed to add tag");
    }
  };

  const removeTag = async (tag) => {
    if (!selectedContact) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/crm/contacts/${selectedContact.id}/tags/${tag}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();
      if (data.status === "success") {
        setContacts(
          contacts.map((contact) =>
            contact.id === selectedContact.id
              ? { ...contact, tags: contact.tags.filter((t) => t !== tag) }
              : contact
          )
        );
      }
    } catch (error) {
      setError("Failed to remove tag");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">CRM Dashboard</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Status Filter
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tag Filter</label>
          <input
            type="text"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Filter by tag..."
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-8">
        {/* Contacts List */}
        <div className="w-1/3">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Contacts</h2>
            {loading ? (
              <p>Loading...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-4 rounded cursor-pointer ${
                      selectedContact?.id === contact.id
                        ? "bg-gray-100"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <h3 className="font-medium">{contact.username}</h3>
                    <p className="text-sm text-gray-600">
                      Status: {contact.status || "N/A"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Last Contact:{" "}
                      {new Date(contact.last_interaction).toLocaleDateString()}
                    </p>
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contact.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-200 rounded-full px-2 py-1"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contact Details */}
        {selectedContact && (
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">
                {selectedContact.username}
              </h2>

              <div className="mb-6">
                <h3 className="font-medium mb-2">Contact Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">First Contact</p>
                    <p>
                      {new Date(
                        selectedContact.first_contact
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Contact</p>
                    <p>
                      {new Date(
                        selectedContact.last_interaction
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <select
                      value={selectedContact.status || ""}
                      onChange={(e) => updateStatus(e.target.value)}
                      className="border rounded px-2 py-1 mt-1"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Messages Sent</p>
                    <p>{selectedContact.messages_sent || 0}</p>
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="mb-6">
                <h3 className="font-medium mb-2">Tags</h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag..."
                      className="flex-1 border rounded px-3 py-2"
                    />
                    <button
                      onClick={addTag}
                      className="bg-secondary text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                      Add Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.tags?.map((tag) => (
                      <div
                        key={tag}
                        className="bg-gray-200 rounded-full px-3 py-1 flex items-center gap-2"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="mb-6">
                <h3 className="font-medium mb-2">Notes</h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 border rounded px-3 py-2"
                    />
                    <button
                      onClick={addNote}
                      className="bg-secondary text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                      Add Note
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedContact.notes?.map((note) => (
                      <div key={note.id} className="bg-gray-50 p-4 rounded">
                        <p>{note.content}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CRM;
