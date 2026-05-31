import { useEffect, useState } from "react";

export default function MessagesPage() {
  const [user] = useState(JSON.parse(localStorage.getItem("user")));
  const [users, setUsers] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [selectedThreadUsername, setSelectedThreadUsername] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newMessage, setNewMessage] = useState({
    recipient_username: "",
    subject: "",
    body: "",
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/users`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load users");
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error("Users loading error:", error);
      setError(error.message);
    }
  };

  const fetchInbox = async () => {
    if (!user?.username) return;

    try {
      const response = await fetch(`/api/messages/inbox/${user.username}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load inbox");
      }

      setInbox(data.messages || []);
    } catch (error) {
      console.error("Inbox loading error:", error);
      setError(error.message);
    }
  };

  const fetchSentMessages = async () => {
    if (!user?.username) return;

    try {
      const response = await fetch(`/api/messages/sent/${user.username}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load sent messages");
      }

      setSentMessages(data.messages || []);
    } catch (error) {
      console.error("Sent messages loading error:", error);
      setError(error.message);
    }
  };

  const fetchMessagesPageData = async () => {
    setError("");
    await fetchUsers();
    await fetchInbox();
    await fetchSentMessages();
  };

  useEffect(() => {
    fetchMessagesPageData();
  }, []);

  const handleMessageChange = (event) => {
    const { name, value } = event.target;

    setNewMessage((prevMessage) => ({
      ...prevMessage,
      [name]: value,
    }));
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setSuccessMessage("");

      const response = await fetch(`/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_username: user.username,
          recipient_username: newMessage.recipient_username,
          subject: newMessage.subject,
          body: newMessage.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to send message");
      }

      setSuccessMessage("Message sent successfully.");

      setSelectedThreadUsername(newMessage.recipient_username);

      setNewMessage({
        recipient_username: "",
        subject: "",
        body: "",
      });

      await fetchInbox();
      await fetchSentMessages();
    } catch (error) {
      console.error("Send message error:", error);
      setError(error.message);
    }
  };

  const handleMarkMessageRead = async (messageId) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/read`, {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Failed to mark message as read");
      }

      await fetchInbox();
    } catch (error) {
      console.error("Mark read error:", error);
      setError(error.message);
    }
  };

  const availableRecipients = users.filter(
    (appUser) => appUser.username !== user?.username
  );

  const getUserDisplayName = (username) => {
    const foundUser = users.find((appUser) => appUser.username === username);
    return foundUser ? foundUser.name : username;
  };

  const allMessages = [...inbox, ...sentMessages].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const threads = allMessages.reduce((threadGroups, message) => {
    const otherUsername =
      message.sender_username === user?.username
        ? message.recipient_username
        : message.sender_username;

    if (!threadGroups[otherUsername]) {
      threadGroups[otherUsername] = [];
    }

    threadGroups[otherUsername].push(message);

    return threadGroups;
  }, {});

  const threadList = Object.entries(threads)
    .map(([username, messages]) => {
      const latestMessage = messages[messages.length - 1];

      const unreadCount = messages.filter(
        (message) =>
          message.recipient_username === user?.username &&
          message.is_read === 0
      ).length;

      return {
        username,
        messages,
        latestMessage,
        unreadCount,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latestMessage.created_at) -
        new Date(a.latestMessage.created_at)
    );

  const selectedThread =
    threads[selectedThreadUsername] ||
    (threadList.length > 0 ? threadList[0].messages : []);

  const selectedThreadPartner =
    selectedThreadUsername || (threadList.length > 0 ? threadList[0].username : "");

  const handleSelectThread = async (threadUsername) => {
    setSelectedThreadUsername(threadUsername);

    const messagesToMarkRead = threads[threadUsername]?.filter(
      (message) =>
        message.recipient_username === user?.username && message.is_read === 0
    );

    if (messagesToMarkRead?.length > 0) {
      for (const message of messagesToMarkRead) {
        await handleMarkMessageRead(message.id);
      }
    }
  };

  const handleQuickReply = () => {
    if (!selectedThreadPartner) return;

    setNewMessage((prevMessage) => ({
      ...prevMessage,
      recipient_username: selectedThreadPartner,
      subject:
        selectedThread.length > 0
          ? selectedThread[selectedThread.length - 1].subject || ""
          : "",
    }));
  };

  return (
    <div className="p-6 bg-[#F6FAFD] min-h-screen">
      <h1 className="text-2xl font-bold text-[#001B3D] mb-2">Messages</h1>
      <p className="text-gray-600 mb-6">
        View conversations as message threads.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {successMessage && (
        <p className="text-green-600 mb-4">{successMessage}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Compose Message */}
        <section className="bg-white rounded-xl shadow p-4 border border-[#D6EAF8]">
          <h2 className="text-xl font-bold mb-4 text-[#001B3D]">
            Compose
          </h2>

          <form onSubmit={handleSendMessage} className="space-y-4">
            <div>
              <label className="block font-semibold mb-2">Recipient</label>
              <select
                name="recipient_username"
                value={newMessage.recipient_username}
                onChange={handleMessageChange}
                className="border rounded px-3 py-2 w-full"
                required
              >
                <option value="">Select recipient</option>
                {availableRecipients.map((appUser) => (
                  <option key={appUser.id} value={appUser.username}>
                    {appUser.name} ({appUser.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-2">Subject</label>
              <input
                type="text"
                name="subject"
                value={newMessage.subject}
                onChange={handleMessageChange}
                className="border rounded px-3 py-2 w-full"
                placeholder="Message subject"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">Message</label>
              <textarea
                name="body"
                value={newMessage.body}
                onChange={handleMessageChange}
                className="border rounded px-3 py-2 w-full"
                rows="6"
                placeholder="Write your message..."
                required
              />
            </div>

            <button
              type="submit"
              className="bg-[#1F6FB2] text-white px-4 py-2 rounded hover:bg-[#155A91]"
            >
              Send Message
            </button>
          </form>
        </section>

        {/* Thread List */}
        <section className="bg-white rounded-xl shadow p-4 border border-[#D6EAF8]">
          <h2 className="text-xl font-bold mb-4 text-[#001B3D]">
            Threads
          </h2>

          {threadList.length === 0 ? (
            <p className="text-gray-600">No message threads yet.</p>
          ) : (
            <div className="space-y-2">
              {threadList.map((thread) => (
                <button
                  key={thread.username}
                  onClick={() => handleSelectThread(thread.username)}
                  className={`w-full text-left border rounded-lg p-3 hover:bg-[#EAF6FF] ${
                    selectedThreadPartner === thread.username
                      ? "bg-[#EAF6FF] border-[#1F6FB2]"
                      : "bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <p className="font-semibold text-[#001B3D]">
                      {getUserDisplayName(thread.username)}
                    </p>

                    {thread.unreadCount > 0 && (
                      <span className="bg-red-600 text-white text-xs rounded-full px-2 py-1">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 truncate mt-1">
                    {thread.latestMessage.body}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {thread.latestMessage.created_at}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Selected Thread */}
        <section className="bg-white rounded-xl shadow p-4 border border-[#D6EAF8] lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#001B3D]">
                {selectedThreadPartner
                  ? getUserDisplayName(selectedThreadPartner)
                  : "Conversation"}
              </h2>

              {selectedThreadPartner && (
                <p className="text-sm text-gray-600">
                  @{selectedThreadPartner}
                </p>
              )}
            </div>

            {selectedThreadPartner && (
              <button
                onClick={handleQuickReply}
                className="bg-[#1F6FB2] text-white px-3 py-2 rounded hover:bg-[#155A91]"
              >
                Reply
              </button>
            )}
          </div>

          {selectedThread.length === 0 ? (
            <p className="text-gray-600">Select a thread to view messages.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {selectedThread.map((message) => {
                const isMine = message.sender_username === user?.username;

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl p-3 border ${
                        isMine
                          ? "bg-[#1F6FB2] text-white border-[#1F6FB2]"
                          : "bg-[#EAF6FF] text-[#001B3D] border-[#D6EAF8]"
                      }`}
                    >
                      <p className="text-sm font-semibold">
                        {isMine ? "You" : getUserDisplayName(message.sender_username)}
                      </p>

                      {message.subject && (
                        <p className="text-sm font-bold mt-1">
                          {message.subject}
                        </p>
                      )}

                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {message.body}
                      </p>

                      <p
                        className={`text-xs mt-2 ${
                          isMine ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {message.created_at}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}