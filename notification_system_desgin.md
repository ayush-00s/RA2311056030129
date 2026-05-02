# Notification System Design

## Stage 1

As a backend developer, I need to design a REST API for a campus notification platform where students get notified about Placements, Events, and Results in real time.

### Core Actions the Platform Should Support

After thinking about what a notification system needs to do, I identified these core actions:
- Fetch all notifications for a logged-in student
- Mark a single notification as read
- Mark all notifications as read
- Get unread notification count
- Create a notification (triggered by admin/system)

### REST API Design

#### 1. Get all notifications

GET /api/notifications
Headers: { Authorization: "Bearer <token>" }Response 200:
{
"notifications": [
{
"id": "uuid",
"type": "Placement",
"message": "Google is hiring",
"isRead": false,
"createdAt": "2026-04-22 17:51:30"
}
]
}

#### 2. Mark a notification as read

PATCH /api/notifications/:id/read
Headers: { Authorization: "Bearer <token>" }
Response 200:
{
"message": "Notification marked as read"
}

#### 3. Mark all notifications as read
PATCH /api/notifications/read-all
Headers: { Authorization: "Bearer <token>" }
Response 200:
{
"message": "All notifications marked as read"
}

#### 4. Get unread count
GET /api/notifications/unread-count
Headers: { Authorization: "Bearer <token>" }
Response 200:
{
"unreadCount": 5
}
#### 5. Create a notification (admin only)

POST /api/notifications
Headers: { Authorization: "Bearer <token>" }
Body:
{
"studentId": 1042,
"type": "Placement",
"message": "Amazon is hiring"
}
Response 201:
{
"message": "Notification created successfully",
"id": "uuid"
}

### Real-Time Notification Mechanism

I chose **WebSockets using Socket.io** for real-time delivery. When a new notification is created, the server emits a `new_notification` event to that specific student's private room. This way the student sees it instantly without refreshing the page. As a fallback for clients that don't support WebSockets, I'd use Server-Sent Events (SSE).

---

## Stage 2

### Database Choice: PostgreSQL

I went with PostgreSQL because the data here is clearly structured and relational — students have notifications, notifications have types and timestamps. PostgreSQL gives us strong ACID guarantees which matters when we're dealing with thousands of concurrent reads and writes. It also has great support for indexing which we'll need as data grows.

### DB Schema

```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Queries for the APIs from Stage 1

```sql
-- Get all notifications for a student
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC;

-- Mark one notification as read
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND student_id = $2;

-- Mark all as read
UPDATE notifications
SET is_read = TRUE
WHERE student_id = $1;

-- Get unread count
SELECT COUNT(*)
FROM notifications
WHERE student_id = $1 AND is_read = FALSE;
```

### Problems as Data Grows and How I'd Solve Them

As the number of students and notifications grows, a few issues will come up:

**Slow queries** — With millions of rows, queries without indexes will do full table scans. I'd add indexes on the columns we query most often.

**Table getting too large** — I'd partition the notifications table by month so each partition is smaller and queries on recent data are faster.

**Old data piling up** — Notifications older than 90 days are probably not useful. I'd archive them to a separate cold storage table periodically.

---

## Stage 3

### Why the Query is Slow

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

With 50,000 students and 5,000,000 notifications, this query is doing a full table scan because there's no index on `studentID` or `isRead`. Also `SELECT *` is fetching every column even ones we don't need which adds unnecessary overhead.

### My Fix

```sql
-- First create a composite index
CREATE INDEX idx_notifications_student_unread
ON notifications (student_id, is_read, created_at DESC);

-- Then rewrite the query
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at DESC
LIMIT 50;
```

This index covers all three conditions in the query so the DB can jump straight to the matching rows instead of scanning everything.

### Should We Index Every Column?

I don't think that's a good idea. My teammate suggested it to "be safe" but indexes aren't free — every time a new notification is inserted or updated, all the indexes on that table have to be updated too. With high write volume like ours, indexing every column would actually slow down inserts a lot. We should only index columns that appear in WHERE, ORDER BY, or JOIN clauses.

### Query to Find Students With Placement Notifications in Last 7 Days

```sql
SELECT DISTINCT s.id, s.name, s.email
FROM students s
JOIN notifications n ON s.id = n.student_id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### The Problem

Every page load hits the database to fetch notifications for that student. With 50,000 students this creates a lot of unnecessary repeated DB queries, especially since notifications don't change every second.

### My Solution: Redis Caching

I'd add a Redis cache layer in front of the database. The idea is simple — the first time a student's notifications are fetched, we store the result in Redis with a short TTL. Every subsequent request within that TTL gets served from Redis instead of the DB.

**How it works:**
1. Request comes in for student's notifications
2. Check Redis first
3. If cache hit → return cached data instantly
4. If cache miss → query DB → store result in Redis → return data

**Cache invalidation:** When a student's notification is marked as read, or a new notification arrives for them, I delete their cache key. This forces the next request to re-fetch fresh data from DB.

### Tradeoffs

| Strategy | Pros | Cons |
|---|---|---|
| No cache | Always fresh data | DB gets hammered at scale |
| Redis with TTL only | Simple, fast | Data can be stale up to TTL |
| Redis + invalidation on write | Fresh + fast | More code complexity, risk of cache stampede |

I'd go with Redis + invalidation. The slight complexity is worth it since stale notifications (showing unread when already read) would be a bad user experience.

---

## Stage 5

### Problems With the Current Implementation

The current approach loops through all 50,000 students one by one and calls `send_email`, `save_to_db`, and `push_to_app` sequentially for each. This is very slow — it could take hours for all students to get notified.

The bigger problem is reliability. If `send_email` fails at student 200, the loop crashes and the remaining 49,800 students never get notified. There's no retry mechanism and no way to know which students were missed.

Also I don't think saving to DB and sending email should happen together in the same step. Email delivery depends on an external API which can fail. The DB save should always succeed regardless of whether the email went through.

### My Redesigned Approach: Message Queue

I'd use a job queue (like Bull with Redis) to make this async and fault-tolerant.

This way even if email fails for some students, the DB is already updated and we have a log of who failed so we can retry just those students.

---

## Stage 6

### My Approach to Priority Inbox

The goal is to always show the top N most important unread notifications. Priority is based on two things — the type of notification and how recent it is.

I assigned weights to each type:
- Placement → 3 (most important)
- Result → 2
- Event → 1

Then I calculate a score for each notification:
score = typeWeight * (1 / (hoursSinceCreated + 1))

This means a newer Placement notification will always score higher than an older one of the same type. And even a very recent Event won't outrank a moderately recent Placement.

### Handling New Notifications Efficiently

The naive approach would be to re-sort all notifications every time a new one comes in — that's O(n log n) every time which gets expensive.

Instead I use a **min-heap of size N**. For each new notification I compute its score. If it's higher than the smallest score in the heap, I replace that entry and re-heapify. This keeps the top N updated in O(log N) time per new notification which is much more efficient at scale.