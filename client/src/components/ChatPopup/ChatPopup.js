import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './ChatPopup.scss';

const ChatPopup = ({ userId, isAdmin = false, apiUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [chatId, setChatId] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    // Connect to the Socket.IO server
    socketRef.current = io(apiUrl, {
      query: {
        userId,
        isAdmin
      }
    });

    // Set up event listeners
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to chat server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from chat server');
    });

    socketRef.current.on('chat_start', (data) => {
      setChatId(data.chatId);
    });

    socketRef.current.on('message', (newMessage) => {
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });

    socketRef.current.on('chat_history', (history) => {
      setMessages(history);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, isAdmin, apiUrl]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load chat history when component mounts or chatId changes
  useEffect(() => {
    if (isConnected && chatId) {
      socketRef.current.emit('get_chat_history', { chatId });
    }
  }, [isConnected, chatId]);

  const toggleChat = () => {
    if (!isOpen && !chatId) {
      // Initiate a new chat when opening for the first time
      socketRef.current.emit('start_chat', { userId });
    }
    setIsOpen(!isOpen);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (message.trim() && isConnected && chatId) {
      const messageData = {
        chatId,
        userId,
        content: message,
        timestamp: new Date(),
        isAdmin
      };
      
      socketRef.current.emit('send_message', messageData);
      setMessage('');
    }
  };

  return (
    <div className="chat-container">
      {/* Chat button */}
      <button 
        className="chat-button"
        onClick={toggleChat}
      >
        {isOpen ? 'Close Chat' : 'Chat with us'}
      </button>

      {/* Chat popup */}
      {isOpen && (
        <div className="chat-popup">
          <div className="chat-header">
            <h3>{isAdmin ? 'Customer Support' : 'Chat with Support'}</h3>
            <button className="close-button" onClick={toggleChat}>×</button>
          </div>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat">
                {isConnected ? 'Start a conversation!' : 'Connecting...'}
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`message ${msg.isAdmin ? 'admin' : 'user'}`}
                >
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chat-input" onSubmit={sendMessage}>
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isConnected}
            />
            <button 
              type="submit" 
              disabled={!message.trim() || !isConnected}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatPopup;