# ChatRoom Frontend

A real-time chatroom UI built with React, Vite, Tailwind CSS and STOMP/WebSocket.  
Allows users to create or join rooms, send text messages and upload images that appear inline in chat.

## 🚀 Features

- Join or create chat rooms  
- Real-time text messaging via SockJS + STOMP  
- Image upload (via multipart) & inline display  
- Auto-scroll chat history  
- Enter-to-send, nice UI with React Icons & Tailwind

## 🛠️ Tech Stack

- **Framework:** React 18 + Vite  
- **Styling:** Tailwind CSS  
- **WebSocket:** SockJS + @stomp/stompjs  
- **HTTP:** Axios  
- **Notifications:** react-hot-toast

## 📋 Prerequisites

- Node.js ≥16  
- npm or yarn  

## 🔧 Setup & Run

1. **Clone repo**  
   ```bash
   git clone <your-frontend-repo-url>
   cd front-chat

npm install
# or
yarn

configure your backend url in AxiosHelper.js to 
export const baseURL = "http://localhost:8080";


then in the terminal use 
npm run dev
# or
yarn dev


Join / Create Room Interface


![image](https://github.com/user-attachments/assets/bb3e7808-0744-4d71-9d9b-d2fb4ca24470)



Chatroom Interface
![image](https://github.com/user-attachments/assets/6fafe566-bd77-4378-b5f5-2873b8e81ce6)








