# Backend Microservices

## 1. Logging Middleware

A reusable logging package that sends structured logs to a remote logging server.

**Usage:**
```js
Log(stack, level, package, message)
```

**Setup:**
```bash
cd logging_middleware
npm install
```

Create a `.env` file:
TOKEN=your_bearer_token


---

## 2. Vehicle Maintenance Scheduler

Fetches depot and vehicle data from the test server and assigns maintenance tasks to each depot using a 0/1 Knapsack algorithm to maximize total impact score within available mechanic hours.

**Setup:**
```bash
cd vehicle_maintence_scheduler
npm install
```

**Run:**
```bash
node index.js
```

**Endpoint:**

| Method | Path | Description |
|---|---|---|
| GET | /schedule | Returns optimized task schedule for all depots |

---

## 3. Notification App

Fetches campus notifications and returns the top N most important ones ranked by type priority and recency.

Priority order: Placement > Result > Event

**Setup:**
```bash
cd notification_app_be
npm install
```

**Run:**
```bash
node index.js
```

**Endpoint:**

| Method | Path | Description |
|---|---|---|
| GET | /priority-inbox?n=10 | Get top N priority notifications |

---

## 4. Notification System Design

See `notification_system_design.md` for the full system design covering REST API contracts, database schema, caching strategy, bulk notification handling, and priority inbox approach.