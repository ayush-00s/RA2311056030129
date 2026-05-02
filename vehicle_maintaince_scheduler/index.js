const axios = require("axios");
const express = require("express");
const app = express();
app.use(express.json());
require("dotenv").config();

const TOKEN = process.env.TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const { Log } = require("../logging_middleware/index");


function knapsack(vehicles, maxHours) {
  const n = vehicles.length;
  if (maxHours <= 500) {
    const dp = Array(n + 1).fill(null).map(() => Array(maxHours + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      const { Duration, Impact } = vehicles[i - 1];
      for (let w = 0; w <= maxHours; w++) {
        dp[i][w] = dp[i - 1][w];
        if (Duration <= w) {
          dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
        }
      }
    }
    let w = maxHours;
    const selected = [];
    for (let i = n; i > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        selected.push(vehicles[i - 1].TaskID);
        w -= vehicles[i - 1].Duration;
      }
    }
    return { maxImpact: dp[n][maxHours], selectedTasks: selected };
  } else {
    const sorted = [...vehicles].sort(
      (a, b) => b.Impact / b.Duration - a.Impact / a.Duration
    );
    let remaining = maxHours;
    let totalImpact = 0;
    const selected = [];
    for (const v of sorted) {
      if (v.Duration <= remaining) {
        selected.push(v.TaskID);
        totalImpact += v.Impact;
        remaining -= v.Duration;
      }
    }
    return { maxImpact: totalImpact, selectedTasks: selected };
  }
}


app.get("/schedule", async (req, res) => {
  try {
    await Log("backend", "info", "route", "GET /schedule endpoint called - fetching depots and vehicles");

    const depotsRes = await axios.get("http://20.207.122.201/evaluation-service/depots", { headers });
    const depots = depotsRes.data.depots;
    await Log("backend", "info", "service", `Fetched ${depots.length} depots successfully`);

    const vehiclesRes = await axios.get("http://20.207.122.201/evaluation-service/vehicles", { headers });
    const vehicles = vehiclesRes.data.vehicles;
    await Log("backend", "info", "service", `Fetched ${vehicles.length} vehicles successfully`);

    const schedule = depots.map((depot) => {
      const result = knapsack(vehicles, depot.MechanicHours);
      Log("backend", "debug", "domain", `Depot ${depot.ID}: selected ${result.selectedTasks.length} tasks with impact ${result.maxImpact}`);
      return {
        depotID: depot.ID,
        mechanicHoursBudget: depot.MechanicHours,
        maxImpactScore: result.maxImpact,
        selectedTasks: result.selectedTasks,
        totalTasksSelected: result.selectedTasks.length,
      };
    });

    await Log("backend", "info", "controller", "Schedule computed successfully for all depots");
    res.json({ schedule });
  } catch (error) {
    await Log("backend", "error", "handler", `Schedule computation failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Vehicle Maintenance Scheduler running on port 3000");
  Log("backend", "info", "service", "Vehicle Maintenance Scheduler server started on port 3000");
});