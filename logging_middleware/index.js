const axios = require("axios");
require("dotenv").config();
const express = require("express");

const TOKEN = process.env.TOKEN;

async function Log(stack, level, package_name, message) {
  const validStacks = ["backend", "frontend"];
  const validLevels = ["debug", "info", "warn", "error", "fatal"];
  const validPackagesBackend = ["cache", "controller", "cron_job", "db", "domain", "handler", "repository", "route", "service"];
  const validPackagesBoth = ["auth", "config", "middleware", "utils"];

  if (!validStacks.includes(stack)) {
    console.error(`Invalid stack: ${stack}`);
    return;
  }
  if (!validLevels.includes(level)) {
    console.error(`Invalid level: ${level}`);
    return;
  }

  try {
    const response = await axios.post(
      "http://20.207.122.201/evaluation-service/logs",
      {
        stack: stack,
        level: level,
        package: package_name,
        message: message,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Log created:", response.data);
    return response.data;
  } catch (error) {
    console.error("Logging failed:", error.message);
  }
}

module.exports = { Log };