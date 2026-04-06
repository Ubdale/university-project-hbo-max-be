const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("./models/User");

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

// Initialize DB
User.init()
  .then(() => console.log("PostgreSQL Connected & Table Ready"))
  .catch((err) => console.error("Database initialization error:", err));

// Routes
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log("Signup attempt:", { name, email });

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = await User.create(name, email, password);

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
    const user = await User.findByEmail(email);

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
    const user = await User.findById(decoded.id);

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
