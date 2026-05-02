const { Log } = require("./index");

async function test() {
  await Log("backend", "info", "handler", "Testing logging middleware - server started successfully");
  await Log("backend", "error", "db", "Critical database connection failure.");
}

test();