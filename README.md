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
- `GET /health`
- Auth: none
- Response: `{ "status": "ok" }`
- Handler: [server/health.js:6](server/health.js#L6)

### Login
- `POST /api/login`
- Auth: none
- Body:
  - `email` (string, required)
  - `password` (string, required)
- Response:
  - `{ "token": "JWT", "user": { ... } }`
- Handler: [server/auth.js:9](server/auth.js#L9)

### Rooms
- `POST /api/rooms`
  - Auth: required
  - Body:
    - `name` (string, required)
    - `inviteCode` (string, optional)
  - Rules:
    - Requester must have an email.
    - Requester becomes manager of the created room and their `roomId` is updated.
  - Response: room object
  - Handler: [server/Rooms.js:7](server/Rooms.js#L7)

- `GET /api/rooms/:roomId`
  - Auth: required (member of room)
  - Response: room object with `roommates` (passwords removed)
  - Handler: [server/Rooms.js:35](server/Rooms.js#L35)

### Roommates
- `GET /api/rooms/:roomId/roommates`
  - Auth: required (member of room)
  - Response: array of roommates (passwords removed)
  - Handler: [server/Roommate.js:8](server/Roommate.js#L8)

- `POST /api/roommates`
  - Auth: required (manager only, same room)
  - Body:
    - `name` (string, required)
    - `email` (string, required)
    - `password` (string, required)
    - `roomId` (string, required)
    - `isManager` (boolean, optional)
  - Response: roommate object (password removed)
  - Handler: [server/Roommate.js:24](server/Roommate.js#L24)

### Expenses
- `GET /api/rooms/:roomId/expenses`
  - Auth: required (member of room)
  - Response: array of expenses with `addedBy` and `approvedBy` sanitized
  - Handler: [server/expense.js:9](server/expense.js#L9)

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

## Postman
Import the collection from `Roomie_BE.postman_collection.json`.
