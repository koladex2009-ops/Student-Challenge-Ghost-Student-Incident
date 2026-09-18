# TechyJaunt — Ghost Student Assignment

Diagnosis and hardening of the Student CRUD API, based on the assignment brief ("The Ghost Student Incident").

## Contents

- [Part A — Diagnosis](./docs/part-a-diagnosis.md)
- [Part B — Build](./docs/part-b-build.md)
- [Part C — Testing](./docs/part-c-testing.md)

## Running locally

```bash
npm install
node app.js
```

Server runs on port 1212, connecting to MongoDB at `techSchoolApp`.

## Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /create-student | Create a new student |
| GET | /get-students | List all students |
| GET | /get-student/:id | Get a single student by ID |
| PUT | /update-student/:id | Replace a student's fields |
| PATCH | /students/:id/course | Update only a student's course |
| GET | /get-student-by-name | Search by exact name |
| GET | /search-students | Search by name, email, or course (partial, case-insensitive) |
| DELETE | /delete-student/:id | Delete a student by ID |


## Deployment

This API is deployed on Render, connected to a MongoDB Atlas cluster.

Live base URL: https://student-challenge-ghost-student-incident.onrender.com

Note: the free-tier instance spins down after inactivity, so the first
request after idle time may take 50+ seconds to respond.