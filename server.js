const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || "your_secret_key";

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Database connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

const todoSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4 },
  userId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  completed: { type: Boolean, default: false },
  priority: { type: String, enum: ["low", "medium", "high"], required: true },
  category: { type: String, required: true },
  tags: [String],
  dueDate: { type: Date },
  subtasks: [
    {
      id: { type: String, default: uuidv4 },
      title: { type: String, required: true },
      completed: { type: Boolean, default: false },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Todo = mongoose.model("Todo", todoSchema);

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Routes
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res
      .status(400)
      .json({ error: "Error registering user", details: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: "Error logging in", details: err.message });
  }
});

app.get("/api/todos", authenticate, async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.status(200).json(todos);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.post("/api/todos", authenticate, async (req, res) => {
  try {
    const { title, description, priority, category, tags, dueDate, subtasks } =
      req.body;

    const newTodo = new Todo({
      userId: req.user.id,
      title,
      description,
      priority,
      category,
      tags,
      dueDate,
      subtasks,
    });

    const savedTodo = await newTodo.save();
    res.status(201).json(savedTodo);
  } catch (err) {
    res.status(400).json({ error: "Validation error", details: err.message });
  }
});

app.put("/api/todos/:id", authenticate, async (req, res) => {
  try {
    const updatedData = { ...req.body, updatedAt: Date.now() };
    const updatedTodo = await Todo.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );

    if (!updatedTodo) return res.status(404).json({ error: "Todo not found" });

    res.status(200).json(updatedTodo);
  } catch (err) {
    res.status(400).json({ error: "Validation error", details: err.message });
  }
});

app.delete("/api/todos/:id", authenticate, async (req, res) => {
  try {
    const deletedTodo = await Todo.findOneAndDelete({
      id: req.params.id,
      userId: req.user.id,
    });

    if (!deletedTodo) return res.status(404).json({ error: "Todo not found" });

    res.status(200).json({ message: "Todo deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Get todos with specified priorities
app.get("/api/todos/filter", authenticate, async (req, res) => {
  try {
    const { priorities } = req.query;
    const priorityArray = priorities ? priorities.split(",") : [];

    const filteredTodos = await Todo.find({
      userId: req.user.id,
      priority: { $in: priorityArray },
    }).sort({ createdAt: -1 });

    res.status(200).json(filteredTodos);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
