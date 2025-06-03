// src/components/JoinCreateChat.jsx
import React, { useState } from "react";
import toast from "react-hot-toast";
import { createRoomApi, joinChatApi } from "../services/RoomService";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";

const JoinCreateChat = () => {
    const [detail, setDetail] = useState({
        roomId: "",
        userName: "",
    });

    const { setRoomId, setCurrentUser, setConnected } = useChatContext();
    const navigate = useNavigate();

    function handleFormInputChange(event) {
        setDetail({
            ...detail,
            [event.target.name]: event.target.value,
        });
    }

    function validateForm() {
        if (detail.roomId.trim() === "" || detail.userName.trim() === "") {
            toast.error("Both fields are required!");
            return false;
        }
        return true;
    }

    async function joinChat() {
        if (!validateForm()) return;

        try {
            const room = await joinChatApi(detail.roomId.trim());
            toast.success("Joined room!");
            setCurrentUser(detail.userName.trim());
            setRoomId(room.roomId);
            setConnected(true);
            navigate("/chat");
        } catch (error) {
            if (error.response?.status === 400) {
                toast.error(error.response.data);
            } else {
                toast.error("Error joining room");
            }
            console.error(error);
        }
    }

    async function createRoom() {
        if (!validateForm()) return;

        try {
            const response = await createRoomApi(detail.roomId.trim());
            toast.success("Room created!");
            setCurrentUser(detail.userName.trim());
            setRoomId(response.roomId);
            setConnected(true);
            navigate("/chat");
        } catch (error) {
            if (error.response?.status === 400) {
                toast.error("Room already exists!");
            } else {
                toast.error("Error creating room");
            }
            console.error(error);
        }
    }

    return (
        <div className="relative min-h-screen bg-gray-900 flex items-center justify-center overflow-hidden">
            {/* Floating Logos Background */}
            <div className="absolute inset-0 overflow-hidden">
                <img
                    src="/Astronaut.png"
                    alt="Astronaut"
                    className="Astronaut absolute"
                    style={{
                        left: "10%",
                        width: "6rem",
                        height: "6rem",
                        animationDelay: "0s",
                        animationDuration: "20s",
                    }}
                />
                <img
                    src="/Astronaut.png"
                    alt="Astronaut"
                    className="Astronaut absolute"
                    style={{
                        left: "30%",
                        width: "5.5rem",
                        height: "5.5rem",
                        animationDelay: "5s",
                        animationDuration: "18s",
                    }}
                />
                <img
                    src="/Astronaut.png"
                    alt="Astronaut"
                    className="Astronaut absolute"
                    style={{
                        left: "50%",
                        width: "7rem",
                        height: "7rem",
                        animationDelay: "2s",
                        animationDuration: "22s",
                    }}
                />
                <img
                    src="/Astronaut.png"
                    alt="Astronaut"
                    className="Astronaut absolute"
                    style={{
                        left: "70%",
                        width: "6.5rem",
                        height: "6.5rem",
                        animationDelay: "7s",
                        animationDuration: "25s",
                    }}
                />
                <img
                    src="/Astronaut.png"
                    alt="Astronaut"
                    className="Astronaut absolute"
                    style={{
                        left: "85%",
                        width: "4.5rem",
                        height: "4.5rem",
                        animationDelay: "3s",
                        animationDuration: "19s",
                    }}
                />
            </div>

            {/* Reliance PetChat Login Card */}
            <div className="relative z-10 max-w-md w-full bg-gray-800/70 border border-gray-700 rounded-2xl shadow-lg backdrop-blur-sm p-8">
                <h1 className="text-3xl font-extrabold text-white text-center mb-6">
                    Reliance PetChat
                </h1>

                <div className="mb-4">
                    <label
                        htmlFor="userName"
                        className="block text-sm font-medium text-gray-300 mb-1"
                    >
                        Your Name
                    </label>
                    <input
                        type="text"
                        id="userName"
                        name="userName"
                        value={detail.userName}
                        onChange={handleFormInputChange}
                        placeholder="Enter your name"
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="mb-6">
                    <label
                        htmlFor="roomId"
                        className="block text-sm font-medium text-gray-300 mb-1"
                    >
                        Room ID / New Room ID
                    </label>
                    <input
                        type="text"
                        id="roomId"
                        name="roomId"
                        value={detail.roomId}
                        onChange={handleFormInputChange}
                        placeholder="Enter room ID"
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex justify-center gap-4">
                    <button
                        onClick={joinChat}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-full transition"
                    >
                        Join Room
                    </button>
                    <button
                        onClick={createRoom}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-full transition"
                    >
                        Create Room
                    </button>
                </div>
            </div>

            {/* CSS for Upward‐Floating Animation */}
            <style>
                {`
          @keyframes floatUp {
            0% {
              transform: translateY(110vh) translateX(0);
              opacity: 0;
            }
            10% {
              opacity: 0.6;
            }
            50% {
              transform: translateY(50vh) translateX(20px);
              opacity: 0.6;
            }
            90% {
              opacity: 0.6;
            }
            100% {
              transform: translateY(-20vh) translateX(-20px);
              opacity: 0;
            }
          }

          .Astronaut {
            animation-name: floatUp;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }
        `}
            </style>
        </div>
    );
};

export default JoinCreateChat;
