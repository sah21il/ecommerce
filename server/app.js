const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const userToken = require("./routes/userTokenRoute");
const OrderModel = require("./models/orderModel");
const ChatModel = require("./models/chatModel");
const mysql = require('mysql2/promise');
const app = express();
app.use(cors());
app.use(express.json());
const { Server } = require('socket.io');
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/token", userToken);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "*", // Replace with your actual domain in production
      methods: ["GET", "POST"]
    }
  });

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'SAH20il04!',
    database: 'chat_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  async function initDatabase() {
    const connection = await pool.getConnection();
    try {
      // Create chats table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS chats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create messages table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chat_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chat_id) REFERENCES chats(id)
        )
      `);
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
    } finally {
      connection.release();
    }
  }
  
  initDatabase();

io.on("connection", (socket) => {
  console.log("A user connected");
  
  const { userId, isAdmin } = socket.handshake.query;
  
  // Join rooms based on role
  if (isAdmin === 'true') {
    socket.join('adminRoom');
    console.log(`Admin joined: ${userId}`);
  } else {
    socket.join(`customer-${userId}`);
    console.log(`Customer joined: ${userId}`);
  }

  socket.on("updateOrderStatus", async ({ orderId, status }) => {
    try {
        await OrderModel.updateOrderStatus(orderId, status);
        io.emit("orderStatusUpdated", { orderId, status }); // This should notify all clients
    } catch (err) {
        console.error("Error updating order status:", err);
    }
});


socket.on("joinRoom", ({ customerId, userRole }) => {
    if (userRole === "admin") {
      socket.join("adminRoom");
    } else {
      socket.join(`customer-${customerId}`);
    }
  });

  // Start a new chat
  socket.on('start_chat', async (data) => {
    try {
      // Check if chat exists for this user
      const [existingChats] = await pool.execute(
        'SELECT id FROM chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [data.userId]
      );
      
      let chatId;
      
      if (existingChats.length > 0) {
        // Use existing chat
        chatId = existingChats[0].id;
      } else {
        // Create a new chat
        const [result] = await pool.execute(
          'INSERT INTO chats (user_id) VALUES (?)',
          [data.userId]
        );
        chatId = result.insertId;
      }
      
      // Notify the client about the chat ID
      socket.emit('chat_start', { chatId });
      console.log(`Chat started with ID: ${chatId} for user: ${data.userId}`);
      
      // If user is not an admin, notify admins about the chat
      if (isAdmin !== 'true') {
        io.to('adminRoom').emit('new_chat', { 
          chatId, 
          userId: data.userId 
        });
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  });

  // Get chat history (new method)
  socket.on('get_chat_history', async (data) => {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`,
        [data.chatId]
      );
      
      const messages = rows.map(row => ({
        chatId: row.chat_id,
        userId: row.user_id,
        content: row.content,
        isAdmin: Boolean(row.is_admin),
        timestamp: row.timestamp
      }));
      
      socket.emit('chat_history', messages);
    } catch (error) {
      console.error('Error getting chat history:', error);
    }
  });

  // Legacy chat history (keep for backward compatibility)
  socket.on("getChatHistory", async ({ customerId }) => {
    if (!customerId) return;
    try {
      const history = await ChatModel.getChatHistory(customerId);
      socket.emit("chatHistory", history);
    } catch (err) {
      console.error("Error fetching chat history:", err);
    }
  });

  // Send message (new method)
  socket.on('send_message', async (data) => {
    try {
      // Save message to database
      const [result] = await pool.execute(
        `INSERT INTO messages (chat_id, user_id, content, is_admin, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.chatId, 
          data.userId, 
          data.content, 
          data.isAdmin === 'true' || data.isAdmin === true ? 1 : 0,
          new Date()
        ]
      );
      
      // Create formatted message
      const messageData = {
        id: result.insertId,
        chatId: data.chatId,
        userId: data.userId,
        content: data.content,
        isAdmin: data.isAdmin === 'true' || data.isAdmin === true,
        timestamp: new Date()
      };
      
      // Broadcast to customer and admin rooms
      io.to(`customer-${data.userId}`).emit('message', messageData);
      io.to('adminRoom').emit('message', messageData);
      
      console.log(`Message sent in chat ${data.chatId}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Legacy send message (keep for backward compatibility)
  socket.on("sendMessage", async ({ customerId, adminId, senderRole, senderName, message }) => {
    if (!customerId || !adminId || !senderRole || !senderName || !message.trim()) {
      console.error("Missing parameters:", { customerId, adminId, senderRole, senderName, message });
      return;
    }

    try {
      const savedMessage = await ChatModel.saveMessage(customerId, adminId, senderRole, senderName, message);

      console.log("Message saved:", savedMessage);

      // Emit message to both customer and admin rooms
      io.to(`customer-${customerId}`).emit("chatMessage", {
        id: savedMessage.insertId,
        customerId,
        adminId,
        senderRole,
        senderName,
        message,
        timestamp: new Date().toISOString(),
      });

      io.to("adminRoom").emit("chatMessage", {
        id: savedMessage.insertId,
        customerId,
        adminId,
        senderRole,
        senderName,
        message,
        timestamp: new Date().toISOString(),
      });

    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  // Typing indicators 
  socket.on("typing", ({ customerId, typing }) => {
    if (typing) {
      io.to(`customer-${customerId}`).emit("typing", true);
      io.to("adminRoom").emit("typing", { customerId, typing: true });
    } else {
      io.to(`customer-${customerId}`).emit("typing", false);
      io.to("adminRoom").emit("typing", { customerId, typing: false });
    }
  });
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));