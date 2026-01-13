# Roomie_BE API

## Overview
Roomie_BE is an Express + Prisma (MongoDB) backend for managing rooms, roommates, and expenses. Authentication uses JWT with a 7-day expiration.

## Setup
1) Install dependencies:
   - `npm install`
2) Create `.env` with:
   - `DATABASE_URL=...`
   - `JWT_SECRET=...`
   - `PORT=4003` (optional; defaults to 4003)
3) Start the server:
   - `npm start`

## Auth
- Login returns a token and user payload.
- Send the token in `Authorization: Bearer <token>` for all `/api` routes except login.
- JWT expires in 7 days.

## Routes

### Health
Quick liveness check.
- `GET /health`
- Auth: none
- Response: `{ "status": "ok" }`
- Handler: [server/health.js:6](server/health.js#L6)

### Login
Authenticate a user and return a JWT.
- `POST /api/login`
- Auth: none
- Body:
  - `email` (string, required)
  - `password` (string, required)
- Response:
  - `{ "token": "JWT", "user": { ... } }`
- Handler: [server/auth.js:9](server/auth.js#L9)

### Rooms
List the current user's room (if any).
- `GET /api/rooms`
  - Auth: required
  - Response: array of rooms for the current user (0 or 1)
  - Handler: [server/Rooms.js:18](server/Rooms.js#L18)

Join a room using an invite code.
- `POST /api/rooms/join`
  - Auth: required
  - Body:
    - `inviteCode` (string, required)
  - Rules:
    - If the user is already in a different room, request is rejected.
  - Response: room object
  - Handler: [server/Rooms.js:31](server/Rooms.js#L31)

Create a new room and make the requester the manager.
- `POST /api/rooms`
  - Auth: required
  - Body:
    - `name` (string, required)
    - `inviteCode` (string, optional)
  - Rules:
    - Requester must have an email.
    - Requester becomes manager of the created room and their `roomId` is updated.
  - Response: room object
  - Handler: [server/Rooms.js:58](server/Rooms.js#L58)

Fetch room details and members.
- `GET /api/rooms/:roomId`
  - Auth: required (member of room)
  - Response: room object with `roommates` (passwords removed)
  - Handler: [server/Rooms.js:88](server/Rooms.js#L88)

Update room name or invite code.
- `PATCH /api/rooms/:roomId`
  - Auth: required (manager only, same room)
  - Body:
    - `name` (string, optional)
    - `inviteCode` (string, optional; must be unique)
  - Response: updated room object
  - Handler: [server/Rooms.js:108](server/Rooms.js#L108)

Regenerate the room invite code.
- `POST /api/rooms/:roomId/invite-code`
  - Auth: required (manager only, same room)
  - Response: updated room with a new invite code
  - Handler: [server/Rooms.js:143](server/Rooms.js#L143)

Delete a room and all related data.
- `DELETE /api/rooms/:roomId`
  - Auth: required (manager only, same room)
  - Response: `{ "status": "deleted" }`
  - Handler: [server/Rooms.js:161](server/Rooms.js#L161)

### Roommates
List roommates in a room.
- `GET /api/rooms/:roomId/roommates`
  - Auth: required (member of room)
  - Response: array of roommates (passwords removed)
  - Handler: [server/Roommate.js:8](server/Roommate.js#L8)

Register a new roommate account.
- `POST /api/roommates/register`
  - Auth: none
  - Body:
    - `name` (string, required)
    - `email` (string, required)
    - `password` (string, required)
    - `roomId` (string, optional)
  - Rules:
    - If `roomId` is provided, the roommate is added to that room.
    - The first roommate in a room becomes manager.
  - Response: roommate object (password removed)
  - Handler: [server/Roommate.js:24](server/Roommate.js#L24)

Add an existing roommate to the manager's room.
- `POST /api/roommates/add-member`
  - Auth: required (manager only, same room)
  - Body:
    - `roommateId` (string, optional)
    - `email` (string, optional)
  - Rules:
    - Provide either `roommateId` or `email`.
    - Roommate cannot already belong to another room.
  - Response: updated roommate object (password removed)
  - Handler: [server/Roommate.js:63](server/Roommate.js#L63)

### Expenses
List expenses for a room.
- `GET /api/rooms/:roomId/expenses`
  - Auth: required (member of room)
  - Response: array of expenses with `addedBy` and `approvedBy` sanitized
  - Handler: [server/expense.js:9](server/expense.js#L9)

Create a new expense for the room.
- `POST /api/rooms/:roomId/expenses`
  - Auth: required (member of room)
  - Body:
    - `description` (string, required)
    - `amount` (number, required)
    - `category` (string, required)
    - `date` (ISO string, required)
    - `addedById` (string, required; must match logged-in user)
  - Response: created expense with `addedByName`
  - Handler: [server/expense.js:36](server/expense.js#L36)

Approve or reject an expense (manager only).
- `POST /api/expenses/:expenseId/status`
  - Auth: required (manager only, same room)
  - Body:
    - `status` (enum: `pending`, `approved`, `rejected`)
  - Response: updated expense with `addedByName` and `approvedByName`
  - Handler: [server/expense.js:70](server/expense.js#L70)

## Notes for Frontend
- IDs are Mongo ObjectId strings (Prisma Mongo provider).
- Passwords are never returned from the API.
- `addedById` on expense creation must match the authenticated user ID.
- Approving/rejecting an expense sets `approvedById` to the logged-in manager.
- Deleting a room removes all roommates and expenses for that room.

## Postman
Import the collection from `Roomie_BE.postman_collection.json`.
