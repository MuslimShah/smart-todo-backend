const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

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
const todoSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4 },
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

const Todo = mongoose.model("Todo", todoSchema);

// Routes
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Backend is running" });
});

app.get("/api/todos", async (req, res) => {
  try {
    const { category, priority, completed, search } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (completed !== undefined) filter.completed = completed === "true";
    if (search)
      filter.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { tags: new RegExp(search, "i") },
      ];

    const todos = await Todo.find(filter).sort({ createdAt: -1 });
    res.status(200).json(todos);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { title, description, priority, category, tags, dueDate, subtasks } =
      req.body;

    const newTodo = new Todo({
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

app.put("/api/todos/:id", async (req, res) => {
  try {
    const updatedData = { ...req.body, updatedAt: Date.now() };
    const updatedTodo = await Todo.findOneAndUpdate(
      { id: req.params.id },
      updatedData,
      { new: true }
    );

    if (!updatedTodo) return res.status(404).json({ error: "Todo not found" });

    res.status(200).json(updatedTodo);
  } catch (err) {
    res.status(400).json({ error: "Validation error", details: err.message });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const deletedTodo = await Todo.findOneAndDelete({ id: req.params.id });

    if (!deletedTodo) return res.status(404).json({ error: "Todo not found" });

    res.status(200).json({ message: "Todo deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.patch("/api/todos/:id/toggle", async (req, res) => {
  try {
    const todo = await Todo.findOne({ id: req.params.id });

    if (!todo) return res.status(404).json({ error: "Todo not found" });

    todo.completed = !todo.completed;
    todo.updatedAt = Date.now();
    await todo.save();

    res.status(200).json(todo);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.put("/api/todos/:id/subtasks/:subtaskId", async (req, res) => {
  try {
    const todo = await Todo.findOne({ id: req.params.id });

    if (!todo) return res.status(404).json({ error: "Todo not found" });

    const subtask = todo.subtasks.find((st) => st.id === req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: "Subtask not found" });

    Object.assign(subtask, req.body);
    todo.updatedAt = Date.now();
    await todo.save();

    res.status(200).json(todo);
  } catch (err) {
    res.status(400).json({ error: "Validation error", details: err.message });
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
