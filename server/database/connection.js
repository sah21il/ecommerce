const mysql2 = require("mysql2");
require('dotenv').config(); // Load environment variables from .env file

let connectionParams;

// Use flag to toggle between localhost and server configurations
const useLocalhost = process.env.USE_LOCALHOST === 'true';

if (useLocalhost) {
    console.log("Using localhost configuration");
    connectionParams = {
        user: "root",
        host: "localhost",
        password: "SAH20il04!",
        database: "ecommerce_db",
    };
} else {
    connectionParams = {
        user: process.env.DB_SERVER_USER,
        host: process.env.DB_SERVER_HOST,
        password: process.env.DB_SERVER_PASSWORD,
        database: process.env.DB_SERVER_DATABASE,
    };
}

// Create a connection pool for better scalability
const pool = mysql2.createPool(connectionParams);

// Handle connection errors more robustly
pool.getConnection((err, connection) => {
    if (err) {
        console.error("Error connecting to database:", err.message);
        // Optionally, you can retry the connection or exit the process
        process.exit(1); // Exit if connection fails
    } else {
        console.log("Database connection established");
        connection.release(); // Release the connection back to the pool
    }
});

// Export the pool
module.exports = pool;
