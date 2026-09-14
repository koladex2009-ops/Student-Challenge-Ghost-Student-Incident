# Part C — Prove it (testing)

### Test 1 — Search finds multiple case-insensitive matches
`GET /search-students?q=ada` returns all students whose name, email, or course contains "ada", regardless of case.

![test 1](../screenshots/test1-search-multiple.png)

### Test 2 — Search with no q
`GET /search-students` with no query parameter returns 400 instead of the whole database.

![test 2](../screenshots/test2-search-no-q.png)

### Test 3 — Get student with invalid ID
`GET /get-student/abc123` returns 400, not a 500 crash.

![test 3](../screenshots/test3-get-invalid-id.png)

### Test 4 — Get student with valid but nonexistent ID
`GET /get-student/507f1f77bcf86cd799439011` returns 404, not 200 with a null student.

![test 4](../screenshots/test4-get-nonexistent-id.png)

### Test 5 — Patch course on a real student
`PATCH /students/:id/course` with `{ "course": "Physics" }` returns 200, and the response body shows the updated course.

![test 5](../screenshots/test5-patch-course-success.png)

### Test 6 — Patch with too-short course
`PATCH /students/:id/course` with `{ "course": "A" }` is rejected by schema validation with 400, not a 500 crash.

![test 6](../screenshots/test6-patch-course-too-short.png)

### Test 7 — Duplicate email on create
Creating a second student with an email that already exists returns 409 Conflict.

![test 7](../screenshots/test7-duplicate-email.png)

### Test 8 — Delete a nonexistent ID
`DELETE /delete-student/507f1f77bcf86cd799439011` returns 404, not a false "deleted successfully" message.

![test 8](../screenshots/test8-delete-nonexistent-id.png)