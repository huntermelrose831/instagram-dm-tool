const express = require("express");
const cors = require("cors");
const sendDMs = require("./sendDMs");
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Test route for Puppeteer login

app.post("/api/send-dm", async (req, res) => {
  const { username, password, targets, message } = req.body;
  try {
    await sendDMs({
      igUsername: username,
      igPassword: password,
      targets,
      message,
    });
    res.json({
      status: "success",
      message: "Logged into Instagram (Puppeteer ran)",
    });
  } catch (err) {
    console.error("Puppeteer error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to log in to Instagram",
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
