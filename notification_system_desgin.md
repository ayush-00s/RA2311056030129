Backend Microservices submission for Afford Medical technologies.

Vehicle maintenance scheduler
Assigns vehicle maintenance tasks to depots using a "0/1 Knapsack algorithm" to maximize total impact within each depot's available mechanic hours.

To Run

npm run vehicle:scheduling

2. Campus Notification Priority Inbox

REST API that fetches campus notifications (Placements, Events, Results) and returns the top N most important unread notifications ranked by type priority and recency.

Endpoints:

METHOD PATH DESCRIPTION

GET /api/vehicle-scheduling Run Depot scheduling

POST /api/notifications/refresh Pull Latest Notification

GET /api/notifications/priority?n=10 Get top N priority

PATCH /api/notifications/:id/read Mark A noticiation

RUN:

npm start

SETUP: npm install

Create a .env file:

BASE_URL=http://20.207.122.201/evaluation-service

EMAIL=

NAME=

ROLL_NO=

ACCESS_CODE=

CLIENT_ID=

CLIENT_SECRET=