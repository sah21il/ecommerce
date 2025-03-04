const db = require("../config/db");

const ChatModel = {
  async getChatHistory(customerId) {
    const query = `SELECT sender, sender_name, message, timestamp
                   FROM chat_messages
                   WHERE customer_id = ?
                   ORDER BY timestamp ASC`;
    const [rows] = await db.execute(query, [customerId]);
    return rows;
  },

  async saveMessage({ customerId, sender, senderName, message }) {
    const query = `INSERT INTO chat_messages (customer_id, sender, sender_name, message)
                   VALUES (?, ?, ?, ?)`;
    await db.execute(query, [customerId, sender, senderName, message]);
    return { customerId, sender, senderName, message, timestamp: new Date() };
  },
};

module.exports = ChatModel;
