// src/components/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  MdAttachFile,
  MdSend,
  MdMoreVert,
  MdSearch,
  MdKeyboardArrowUp,
  MdKeyboardArrowDown,
} from "react-icons/md";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import toast from "react-hot-toast";
import { baseURL, httpClient } from "../config/AxiosHelper";
import { getMessagess } from "../services/RoomService";

const ChatPage = () => {
  const {
    roomId,
    currentUser,
    connected,
    setConnected,
    setRoomId,
    setCurrentUser,
  } = useChatContext();

  const navigate = useNavigate();
  useEffect(() => {
    if (!connected) {
      navigate("/");
    }
  }, [connected, roomId, currentUser, navigate]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const chatBoxRef = useRef(null);
  const [stompClient, setStompClient] = useState(null);

  // For image upload
  const fileInputRef = useRef(null);

  // Autocomplete / mentions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [caretPosition, setCaretPosition] = useState(0);

  // Mentions queue
  const [mentions, setMentions] = useState([]);

  // “Reply to” state
  const [replyTo, setReplyTo] = useState(null);

  // ------------- Search UI state -------------
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]); // array of message indices
  const [currentSearchIdx, setCurrentSearchIdx] = useState(-1);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // ----------------------------------------------------------------
  // Helper: format date header (Today/Yesterday or full date)
  // ----------------------------------------------------------------
  const formatDateHeader = (dateObj) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dString = dateObj.toDateString();
    if (dString === today.toDateString()) return "Today";
    if (dString === yesterday.toDateString()) return "Yesterday";

    // Otherwise, show e.g. "Jun 5, 2025"
    return dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ----------------------------------------------------------------
  // Helper: format a timestamp as HH:mm (24-hour)
  // ----------------------------------------------------------------
  const formatTimeStamp = (timestamp) => {
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // ----------------------------------------------------------------
  // Load existing messages & derive member list
  // ----------------------------------------------------------------
  useEffect(() => {
    async function loadInitialData() {
      try {
        const msgs = await getMessagess(roomId);
        setMessages(msgs);
        // Derive members from distinct senders
        const senders = Array.from(new Set(msgs.map((m) => m.sender)));
        if (!senders.includes(currentUser)) senders.push(currentUser);
        setAllMembers(senders);
      } catch (error) {
        console.error("Failed loading messages or members:", error);
      }
    }
    if (connected) {
      loadInitialData();
    }
  }, [connected, roomId, currentUser]);

  // ----------------------------------------------------------------
  // Auto‐scroll to bottom on new message
  // ----------------------------------------------------------------
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scroll({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // ----------------------------------------------------------------
  // WebSocket connection & subscription
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!connected) return;
    const sock = new SockJS(`${baseURL}/chat`);
    const client = Stomp.over(sock);
    client.connect({}, () => {
      setStompClient(client);
      toast.success("connected");
      client.subscribe(`/topic/room/${roomId}`, (frame) => {
        const incoming = JSON.parse(frame.body);

        // Update or append the incoming message:
        setMessages((prev) => {
          const idx = prev.findIndex(
              (m) => m.messageId === incoming.messageId
          );
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = incoming;
            return copy;
          } else {
            return [...prev, incoming];
          }
        });

        // If sender is new, add to members
        setAllMembers((prevMembers) => {
          if (!prevMembers.includes(incoming.sender)) {
            return [...prevMembers, incoming.sender];
          }
          return prevMembers;
        });

        // If I was mentioned, queue a badge
        if (
            incoming.mentionedUsers &&
            incoming.mentionedUsers.includes(currentUser)
        ) {
          setMentions((prevQueue) => [...prevQueue, incoming.messageId]);
        }
      });
    });
  }, [connected, roomId, currentUser]);

  // ----------------------------------------------------------------
  // Handle “@” autocomplete input changes
  // ----------------------------------------------------------------
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setCaretPosition(e.target.selectionStart);

    const textUpToCaret = val.substring(0, e.target.selectionStart);
    const atIndex = textUpToCaret.lastIndexOf("@");
    if (atIndex === -1) {
      setShowSuggestions(false);
      return;
    }
    const fragment = textUpToCaret.substring(atIndex + 1);
    if (!/^[\w]*$/.test(fragment)) {
      setShowSuggestions(false);
      return;
    }
    const filtered = allMembers
        .filter(
            (u) =>
                u !== currentUser &&
                u.toLowerCase().startsWith(fragment.toLowerCase())
        )
        .slice(0, 5);
    if (filtered.length > 0 && fragment.length >= 1) {
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // ----------------------------------------------------------------
  // Insert selected mention (autocomplete)
  // ----------------------------------------------------------------
  const pickSuggestion = (username) => {
    const caret = caretPosition;
    const val = input;
    const textUpToCaret = val.substring(0, caret);
    const atIndex = textUpToCaret.lastIndexOf("@");
    if (atIndex === -1) return;

    const beforeAt = val.substring(0, atIndex);
    const afterCaret = val.substring(caret);

    const newVal = `${beforeAt}@${username} ${afterCaret}`;
    setInput(newVal);
    setShowSuggestions(false);

    const newPos = beforeAt.length + username.length + 2;
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // ----------------------------------------------------------------
  // Scroll to a specific message by ID (and highlight briefly)
  // ----------------------------------------------------------------
  const scrollToMessage = (messageId) => {
    const el = document.querySelector(`[data-msgid='${messageId}']`);
    if (el && chatBoxRef.current) {
      const topOfElement = el.offsetTop;
      chatBoxRef.current.scrollTo({
        top: topOfElement - 40,
        behavior: "smooth",
      });
    }
    // Highlight that message for a short time
    setHighlightedMessageId(messageId);
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2000); // highlight for 2 seconds
  };

  // ----------------------------------------------------------------
  // Handle unread mention badge click
  // ----------------------------------------------------------------
  const handleMentionBadgeClick = () => {
    if (mentions.length === 0) return;
    const nextMsgId = mentions[0];
    scrollToMessage(nextMsgId);
    setMentions((prev) => prev.slice(1));
  };

  // ----------------------------------------------------------------
  // Toggle search bar
  // ----------------------------------------------------------------
  const toggleSearch = () => {
    setShowSearch((prev) => !prev);
    setSearchTerm("");
    setSearchResults([]);
    setCurrentSearchIdx(-1);
    setHighlightedMessageId(null);
  };

  // ----------------------------------------------------------------
  // Perform search (Enter or clicking “Go”)
  // ----------------------------------------------------------------
  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      toast.error("Enter a search term");
      return;
    }
    // Find all message indices whose content (if any) includes term
    const results = messages
        .map((m, idx) => ({ m, idx }))
        .filter(({ m }) => m.content && m.content.toLowerCase().includes(term))
        .map(({ idx }) => idx);

    if (results.length === 0) {
      toast("No matches found");
      setSearchResults([]);
      setCurrentSearchIdx(-1);
      return;
    }
    setSearchResults(results);

    // Jump to the last occurrence
    const lastIdx = results[results.length - 1];
    const messageId = messages[lastIdx].messageId;
    scrollToMessage(messageId);
    setCurrentSearchIdx(results.length - 1);
  };

  // ----------------------------------------------------------------
  // Navigate to previous search match
  // ----------------------------------------------------------------
  const goToPreviousMatch = () => {
    if (searchResults.length === 0) return;
    const newIdx =
        (currentSearchIdx - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIdx(newIdx);
    const messageId = messages[searchResults[newIdx]].messageId;
    scrollToMessage(messageId);
  };

  // ----------------------------------------------------------------
  // Navigate to next search match
  // ----------------------------------------------------------------
  const goToNextMatch = () => {
    if (searchResults.length === 0) return;
    const newIdx = (currentSearchIdx + 1) % searchResults.length;
    setCurrentSearchIdx(newIdx);
    const messageId = messages[searchResults[newIdx]].messageId;
    scrollToMessage(messageId);
  };

  // ----------------------------------------------------------------
  // Send text message (including replyToMessageId)
  // ----------------------------------------------------------------
  const sendMessage = async () => {
    if (stompClient && connected && input.trim()) {
      const messagePayload = {
        sender: currentUser,
        content: input,
        roomId: roomId,
        imageUrl: null,
        mentionedUsers: [],
        replyToMessageId: replyTo ? replyTo.messageId : null,
      };
      stompClient.send(
          `/app/sendMessage/${roomId}`,
          {},
          JSON.stringify(messagePayload)
      );
      setInput("");
      setShowSuggestions(false);
      setReplyTo(null);
    }
  };

  // ----------------------------------------------------------------
  // Handle image upload (including replyToMessageId)
  // ----------------------------------------------------------------
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !stompClient) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sender", currentUser);
    formData.append("replyToMessageId", replyTo ? replyTo.messageId : "");

    try {
      await httpClient.post(
          `/api/v1/rooms/${roomId}/images`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
      );
    } catch (err) {
      console.error("Image upload failed", err);
      toast.error("Image upload failed");
    }
    setReplyTo(null);
  };

  // ----------------------------------------------------------------
  // Start replying to a message
  // ----------------------------------------------------------------
  const startReply = (message) => {
    setReplyTo(message);
  };

  // ----------------------------------------------------------------
  // Cancel reply
  // ----------------------------------------------------------------
  const cancelReply = () => {
    setReplyTo(null);
  };

  // ----------------------------------------------------------------
  // Delete for Me (unchanged)
  // ----------------------------------------------------------------
  const deleteForMe = async (messageId) => {
    try {
      const response = await httpClient.delete(
          `/api/v1/rooms/${roomId}/messages/${messageId}/deleteForMe`,
          { params: { user: currentUser } }
      );
      if (response.status !== 200) {
        throw new Error("Status " + response.status);
      }
    } catch (err) {
      console.error(
          "Delete for Me failed:",
          err.response?.data || err.message
      );
      toast.error("Delete for Me failed: " + (err.response?.data || err.message));
    }
  };

  // ----------------------------------------------------------------
  // Delete for Everyone (unchanged)
  // ----------------------------------------------------------------
  const deleteForEveryone = async (messageId) => {
    try {
      const response = await httpClient.delete(
          `/api/v1/rooms/${roomId}/messages/${messageId}/deleteForEveryone`
      );
      if (response.status !== 200) {
        throw new Error("Status " + response.status);
      }
    } catch (err) {
      console.error(
          "Delete for Everyone failed:",
          err.response?.data || err.message
      );
      toast.error(
          "Delete for Everyone failed: " + (err.response?.data || err.message)
      );
    }
  };

  // ----------------------------------------------------------------
  // Logout (unchanged)
  // ----------------------------------------------------------------
  const handleLogout = () => {
    stompClient?.disconnect();
    setConnected(false);
    setRoomId("");
    setCurrentUser("");
    navigate("/");
  };

  // ----------------------------------------------------------------
  // Build a flat array of React nodes: date‐headers + message bubbles
  // ----------------------------------------------------------------
  const renderedMessages = [];
  let lastDateString = "";

  messages.forEach((message, index) => {
    // If soft‐deleted for this user → skip entirely
    if (message.deletedBy && message.deletedBy.includes(currentUser)) {
      return;
    }

    // Determine this message’s date string (e.g. “Wed Jun 05 2025”)
    const msgDateObj = new Date(message.timeStamp);
    const msgDateString = msgDateObj.toDateString();

    // If it’s a new date (or first message), insert a date header
    if (msgDateString !== lastDateString) {
      lastDateString = msgDateString;
      const dateHeading = formatDateHeader(msgDateObj);
      renderedMessages.push(
          <div
              key={`date-${msgDateString}`}
              className="flex justify-center my-4"
          >
            <div className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
              {dateHeading}
            </div>
          </div>
      );
    }

    // If hard‐deleted for everyone, show placeholder and move on
    if (message.deletedForEveryone) {
      renderedMessages.push(
          <div key={`deleted-${message.messageId}`} className="flex justify-center my-2">
            <div className="bg-gray-700 p-2 rounded max-w-xs">
              <p className="text-gray-300 italic text-center">
                This message was deleted
              </p>
            </div>
          </div>
      );
      return;
    }

    // Normal or updated message → render as before, but with HH:mm timestamp
    const isOwn = message.sender === currentUser;
    const isHighlighted = message.messageId === highlightedMessageId;

    // If this message is a reply, find the original
    let original = null;
    if (message.replyToMessageId) {
      original = messages.find(
          (m) => m.messageId === message.replyToMessageId
      );
    }

    renderedMessages.push(
        <div
            key={message.messageId}
            data-msgid={message.messageId}
            className={`flex ${
                isOwn ? "justify-end" : "justify-start"
            } items-start mb-2`}
        >
          {/* ────────────── THREE‐DOTS BUTTON ────────────── */}
          <div className="relative group">
            <button className="text-gray-400 hover:text-gray-200 focus:outline-none">
              <MdMoreVert size={20} />
            </button>
            {/* Dropdown appears on hover */}
            <div
                className="
              hidden
              group-hover:block
              absolute top-full
              right-0
              mt-1
              w-44
              bg-gray-700
              rounded
              shadow-lg
              z-10
            "
            >
              <button
                  onClick={() => startReply(message)}
                  className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
              >
                Reply
              </button>
              {isOwn && (
                  <>
                    <button
                        onClick={() => deleteForMe(message.messageId)}
                        className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
                    >
                      Delete for Me
                    </button>
                    <button
                        onClick={() => deleteForEveryone(message.messageId)}
                        className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600"
                    >
                      Delete for Everyone
                    </button>
                  </>
              )}
            </div>
          </div>

          {/* ────────────── AVATAR + MESSAGE BUBBLE ────────────── */}
          <div
              className={`ml-2 ${
                  isOwn ? "bg-green-700" : "bg-gray-800"
              } p-3 max-w-xs rounded relative ${
                  isHighlighted ? "ring-2 ring-purple-400" : ""
              }`}
          >
            {/* If this is a reply, render a WhatsApp-style “quoted” box above */}
            {original && (
                <div className="mb-2 bg-green-50 border-l-4 border-green-500 rounded-l-lg p-2">
                  <p className="text-sm font-semibold text-green-700">
                    {original.sender}
                  </p>
                  <p className="text-sm text-green-800">
                    {original.content
                        ? original.content
                        : original.imageUrl
                            ? "📷 Photo"
                            : ""}
                  </p>
                </div>
            )}

            <div className="flex flex-row gap-2 items-start">
              <img
                  className="h-10 w-10 rounded-full"
                  src="https://avatar.iran.liara.run/public/43"
                  alt={`${message.sender}'s avatar`}
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-white">
                  {message.sender}
                </p>
                {message.content && (
                    <p className="text-white">
                      {message.content
                          .split(/(\@\w+)/g)
                          .map((piece, i) => {
                            if (piece.startsWith("@")) {
                              const uname = piece.substring(1);
                              if (uname === currentUser) {
                                return (
                                    <span
                                        key={i}
                                        className="bg-purple-500 px-1 rounded"
                                    >
                              {piece}
                            </span>
                                );
                              }
                            }
                            return <span key={i}>{piece}</span>;
                          })}
                    </p>
                )}
                {message.imageUrl && (
                    <div className="flex justify-center my-1">
                      <img
                          src={`${baseURL}${message.imageUrl}`}
                          alt="uploaded content"
                          className="max-w-full h-auto object-contain rounded"
                      />
                    </div>
                )}
                <p className="text-xs text-gray-400">
                  {formatTimeStamp(message.timeStamp)}
                </p>
              </div>
            </div>
          </div>
        </div>
    );
  });

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
  return (
      <div className="relative h-screen">
        {/* Header with three-dot menu and mention badge */}
        <header className="fixed top-0 left-0 w-full dark:bg-gray-900 py-4 shadow flex justify-between items-center px-6 z-20">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-white">
              Room: <span className="font-normal">{roomId}</span>
            </h1>
            <h1 className="text-xl font-semibold text-white">
              User: <span className="font-normal">{currentUser}</span>
            </h1>

            {/* Unread mention badge */}
            {mentions.length > 0 && (
                <button
                    onClick={handleMentionBadgeClick}
                    className="ml-4 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-full flex items-center gap-1"
                >
                  <span className="font-mono">@{mentions.length}</span>
                  <span className="text-xs">mentions</span>
                </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Three-dot menu toggles search bar */}
            <button
                onClick={toggleSearch}
                className="text-gray-300 hover:text-white focus:outline-none"
            >
              <MdMoreVert size={24} />
            </button>

            <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full"
            >
              Leave Room
            </button>
          </div>
        </header>

        {/* Search bar dropdown */}
        {showSearch && (
            <div className="fixed top-16 left-0 w-full dark:bg-gray-800 py-2 shadow-md z-20">
              <form
                  onSubmit={handleSearch}
                  className="mx-auto w-2/3 flex items-center gap-2 bg-gray-700 rounded-full px-4 py-1"
              >
                <MdSearch size={20} className="text-gray-300" />
                <input
                    type="text"
                    placeholder="Search chat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-white px-2"
                />

                {/* Up/Down arrows & counter */}
                {searchResults.length > 0 && (
                    <div className="flex items-center gap-1 text-white">
                      <button
                          type="button"
                          onClick={goToPreviousMatch}
                          className="p-1 hover:bg-gray-600 rounded"
                      >
                        <MdKeyboardArrowUp size={18} />
                      </button>
                      <span className="text-sm">
                  {currentSearchIdx + 1}/{searchResults.length}
                </span>
                      <button
                          type="button"
                          onClick={goToNextMatch}
                          className="p-1 hover:bg-gray-600 rounded"
                      >
                        <MdKeyboardArrowDown size={18} />
                      </button>
                    </div>
                )}

                <button type="submit" className="text-gray-300 hover:text-white">
                  Go
                </button>
              </form>
            </div>
        )}

        {/* Chat history (fills entire area between header and input) */}
        <main
            ref={chatBoxRef}
            className="absolute top-20 bottom-20 left-0 right-0 px-6 dark:bg-slate-600 overflow-auto"
        >
          {renderedMessages}
        </main>

        {/* If the user clicked “Reply,” show a preview just above the input */}
        {replyTo && (
            <div className="fixed bottom-20 left-6 right-6 bg-gray-700 text-white p-2 rounded flex justify-between items-center z-20">
              <div>
                <p className="text-sm font-semibold">
                  Replying to {replyTo.sender}
                </p>
                <p className="text-xs truncate">
                  {replyTo.content
                      ? replyTo.content
                      : replyTo.imageUrl
                          ? "📷 Photo"
                          : ""}
                </p>
              </div>
              <button
                  onClick={cancelReply}
                  className="text-gray-300 hover:text-white text-xl font-bold"
              >
                ×
              </button>
            </div>
        )}

        {/* Hidden file input */}
        <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
        />

        {/* Input bar */}
        <div className="fixed bottom-0 left-0 w-full h-20 flex items-center justify-center bg-transparent px-6 z-10">
          <div className="relative w-2/3 flex items-center gap-4 bg-gray-900 rounded-full px-4 py-2">
            <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !showSuggestions) {
                    sendMessage();
                  }
                }}
                type="text"
                placeholder="Type your message here..."
                className="w-full bg-gray-800 px-4 py-2 rounded-full focus:outline-none text-white"
            />
            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute bottom-14 left-0 w-full bg-gray-700 rounded-md shadow-lg max-h-40 overflow-auto z-20">
                  {suggestions.map((username, idx) => (
                      <li
                          key={idx}
                          onClick={() => pickSuggestion(username)}
                          className="px-4 py-2 hover:bg-gray-600 cursor-pointer text-white"
                      >
                        {username}
                      </li>
                  ))}
                </ul>
            )}
            <button
                onClick={() => fileInputRef.current.click()}
                className="bg-purple-600 hover:bg-purple-700 p-2 rounded-full"
            >
              <MdAttachFile size={20} color="white" />
            </button>
            <button
                onClick={sendMessage}
                className="bg-green-600 hover:bg-green-700 p-2 rounded-full"
            >
              <MdSend size={20} color="white" />
            </button>
          </div>
        </div>
      </div>
  );
};

export default ChatPage;

