const axios = require("axios");
const express = require("express");
const app = express();
app.use(express.json());
require("dotenv").config();

const TOKEN = process.env.TOKEN;
const { Log } = require("../logging_middleware/index");

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const TYPE_WEIGHTS = {
  Placement: 3,
  Result: 2,
  Event: 1,
};


function getPriorityScore(notification) {
  const weight = TYPE_WEIGHTS[notification.Type] || 1;
  const createdAt = new Date(notification.Timestamp);
  const now = new Date();
  const hoursSince = (now - createdAt) / (1000 * 60 * 60);
  return weight * (1 / (hoursSince + 1));
}

class MinHeap {
  constructor(n) {
    this.heap = [];
    this.maxSize = n;
  }

  push(item) {
    if (this.heap.length < this.maxSize) {
      this.heap.push(item);
      this.heap.sort((a, b) => a.score - b.score); 
    } else if (item.score > this.heap[0].score) {
      this.heap[0] = item;
      this.heap.sort((a, b) => a.score - b.score);
    }
  }

  getTopN() {
    return this.heap.sort((a, b) => b.score - a.score); 
  }
}

// GET /priority-inbox?n=10
app.get("/priority-inbox", async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 10;

    await Log("backend", "info", "route", `GET /priority-inbox called with n=${n}`);

    const response = await axios.get(
      "http://20.207.122.201/evaluation-service/notifications",
      { headers }
    );

    const notifications = response.data.notifications;
    await Log("backend", "info", "service", `Fetched ${notifications.length} notifications from API`);

    // Build top-N using min-heap
    const heap = new MinHeap(n);
    for (const notif of notifications) {
      const score = getPriorityScore(notif);
      heap.push({ ...notif, score });
    }

    const topN = heap.getTopN();
    await Log("backend", "info", "controller", `Returning top ${topN.length} priority notifications`);

    res.json({
      total_fetched: notifications.length,
      top_n: n,
      priority_inbox: topN,
    });
  } catch (error) {
    await Log("backend", "error", "handler", `Priority inbox failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(4000, () => {
  console.log("Notification app running on port 4000");
  Log("backend", "info", "service", "Notification app server started on port 4000");
});