// src/components/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { MdAttachFile, MdSend } from "react-icons/md";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import toast from "react-hot-toast";
import { baseURL, httpClient } from "../config/AxiosHelper";
import { getMessagess } from "../services/RoomService";
import { timeAgo } from "../config/helper";

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
  const fileInputRef = useRef(null);

  // Load existing messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const msgs = await getMessagess(roomId);
        setMessages(msgs);
      } catch (error) {
        console.error("Failed loading messages:", error);
      }
    }
    if (connected) {
      loadMessages();
    }
  }, [connected, roomId]);

  // Auto‐scroll on new message
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scroll({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // WebSocket connect + subscribe
  useEffect(() => {
    if (!connected) return;
    const sock = new SockJS(`${baseURL}/chat`);
    const client = Stomp.over(sock);
    const token = localStorage.getItem("authToken");

    client.connect(
        { Authorization: `Bearer ${token}` },
        () => {
          setStompClient(client);
          toast.success("connected");
          client.subscribe(`/topic/room/${roomId}`, (frame) => {
            const incoming = JSON.parse(frame.body);
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.messageId === incoming.messageId);
              if (idx !== -1) {
                const copy = [...prev];
                copy[idx] = incoming;
                return copy;
              } else {
                return [...prev, incoming];
              }
            });
          });
        },
        (error) => {
          console.error("STOMP error:", error);
          toast.error("WebSocket connection failed");
        }
    );
  }, [connected, roomId]);

  // Send text message
  const sendMessage = async () => {
    if (stompClient && connected && input.trim()) {
      const message = {
        sender: currentUser,
        content: input,
        roomId: roomId,
      };
      stompClient.send(`/app/sendMessage/${roomId}`, {}, JSON.stringify(message));
      setInput("");
    }
  };

  // Handle image upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !stompClient) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sender", currentUser);

    try {
      await httpClient.post(
          `/api/v1/rooms/${roomId}/images`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
      );
      // No STOMP send here—backend will broadcast once.
    } catch (err) {
      console.error("Image upload failed", err);
      toast.error("Image upload failed");
    }
  };

  // Delete for me (soft delete)
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

  // Delete for everyone (hard delete)
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

  // Logout
  const handleLogout = () => {
    stompClient?.disconnect();
    setConnected(false);
    setRoomId("");
    setCurrentUser("");
    navigate("/");
  };

  return (
      <div className="">
        {/* 1) Header: fixed at top, explicitly h-16 (64px) */}
        <header className="fixed top-0 left-0 w-full h-16 dark:bg-gray-900 dark:border-gray-700 py-4 px-6 shadow flex justify-between items-center z-10">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-semibold text-white">
              Room : <span className="font-normal">{roomId}</span>
            </h1>
            <h1 className="text-xl font-semibold text-white">
              User : <span className="font-normal">{currentUser}</span>
            </h1>
          </div>
          <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full"
          >
            Leave Room
          </button>
        </header>

        {/*
        2) Chat history <main>:
           - mt-16 pushes it down exactly 64px (header height).
           - mb-16 leaves 64px space at bottom (input bar height).
           - h-[calc(100vh-128px)] → 100vh minus header (64px) minus input bar (64px).
           - overflow-auto confines scrolling to this box.
      */}
        <main
            ref={chatBoxRef}
            className="mt-16 mb-16 px-10 w-2/3 dark:bg-slate-600 mx-auto overflow-auto h-[calc(100vh-128px)]"
        >
          {messages.map((message, index) => {
            // Soft-deleted for this user → skip
            if (message.deletedBy && message.deletedBy.includes(currentUser)) {
              return null;
            }

            // Hard-deleted for everyone → show placeholder
            if (message.deletedForEveryone) {
              return (
                  <div key={index} className="flex justify-center my-2">
                    <div className="bg-gray-700 p-2 rounded max-w-xs">
                      <p className="text-gray-300 italic text-center">
                        This message was deleted
                      </p>
                    </div>
                  </div>
              );
            }

            const isOwnMessage = message.sender === currentUser;
            return (
                <div
                    key={index}
                    className={`flex ${
                        isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                      className={`my-2 ${
                          isOwnMessage ? "bg-green-800" : "bg-gray-800"
                      } p-3 max-w-xs rounded relative`}
                  >
                    <div className="flex flex-row gap-2">
                      <img
                          className="h-10 w-10 rounded-full"
                          src="https://avatar.iran.liara.run/public/43"
                          alt=""
                      />
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-bold text-white">
                          {message.sender}
                        </p>
                        {message.content && (
                            <p className="text-white">{message.content}</p>
                        )}
                        {message.imageUrl && (
                            <div className="flex justify-center my-1">
                              <img
                                  src={message.imageUrl}
                                  alt="upload"
                                  className="max-w-full h-auto object-contain rounded"
                              />
                            </div>
                        )}
                        <p className="text-xs text-gray-400">
                          {timeAgo(message.timeStamp)}
                        </p>
                      </div>
                    </div>

                    {/* Delete menu for your own messages */}
                    {isOwnMessage && (
                        <div className="absolute top-1 right-1 group relative">
                          <button className="text-gray-400 hover:text-gray-200 focus:outline-none">
                            ⋮
                          </button>
                          <div className="hidden group-hover:block absolute top-full right-0 mt-1 w-44 bg-gray-700 rounded shadow-lg z-10">
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
                          </div>
                        </div>
                    )}
                  </div>
                </div>
            );
          })}
        </main>

        {/* 3) Hidden file input for image uploads */}
        <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
        />

        {/*
        4) Input bar fixed at bottom (h-16 = 64px).  
           Since <main> has mb-16, chat messages never slip under this bar.
      */}
        <div className="fixed bottom-0 left-0 w-full h-16 px-6 bg-transparent flex items-center justify-center">
          <div className="w-2/3 flex items-center gap-4 bg-gray-900 rounded-full px-4 py-2">
            <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                type="text"
                placeholder="Type your message here..."
                className="w-full bg-gray-800 px-4 py-2 rounded-full focus:outline-none text-white"
            />
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
