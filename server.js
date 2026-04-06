const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "hbo-max-secret-key-2026";

// Middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || "*", // Fallback to * for local dev if not set
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// Database Connection
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_QOd5esguc1Nf@ep-misty-brook-a14lfjb2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize users table
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("PostgreSQL Connected & Table Ready");
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}
initDB();

// Routes
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log("Signup attempt:", { name, email });

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, password],
    );
    const newUser = result.rows[0];

    console.log("User saved successfully with ID:", newUser.id);

    // Auto-login: Generate JWT token after signup
    const token = jwt.sign(
      { email: newUser.email, id: newUser.id },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user || user.password !== password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Verify token endpoint
app.post("/api/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [decoded.id],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid token", error: error.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ message: "HBO Max Clone API is live!", status: "Running" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
