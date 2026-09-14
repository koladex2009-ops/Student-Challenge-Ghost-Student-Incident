## Part B — Build

### B1 — GET /search-students

This route reads the search text from a query parameter named `q` (not a URL param, not the body), and searches the `name`, `email`, and `course` fields for a case-insensitive match anywhere in the value — not just an exact match.

```javascript
app.get("/search-students", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({
      message: "Search query q is required"
    });
  }

  try {
    const searchText = q.trim();

    const students = await Student.find({
      $or: [
        { name: { $regex: searchText, $options: "i" } },
        { email: { $regex: searchText, $options: "i" } },
        { course: { $regex: searchText, $options: "i" } }
      ]
    });

    return res.status(200).json(students);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});
```

If `q` is missing or empty, the route responds `400` before ever touching the database. MongoDB itself performs the matching using `$regex` combined with `$or` across the three fields, rather than fetching every student and filtering in JavaScript. If no student matches, the route still returns `200` with an empty array, since a search endpoint finding zero results is not an error — the request itself succeeded.



### B2 — Hardened GET /get-student/:id

This route now validates the ID's format before querying the database, and distinguishes between "no student found" and "malformed ID."

```javascript
app.get("/get-student/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID. The ID must be a valid MongoDB ObjectId."
    });
  }

  try {
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    return res.status(200).json({
      message: "Student fetched successfully",
      student
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});
```

**Research note — `isValid()` limitation:** `mongoose.Types.ObjectId.isValid()` only checks that the string has the correct *shape* (24 hexadecimal characters, or a few other formats Mongoose accepts) — it does not check whether a document with that ID actually exists. For example, `"507f1f77bcf86cd799439011"` is a well-formed ObjectId and passes `isValid()`, even if no student was ever created with that ID. This is why the separate "student not found" check is still required after the format check passes.



### B3 — PATCH /students/:id/course

This route updates only the `course` field, without replacing the whole document.

```javascript
course: {
  type: String,
  minlength: [2, "Course must be at least 2 characters long"]
},
```

```javascript
app.patch("/students/:id/course", async (req, res) => {
  const { id } = req.params;
  const { course } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID. The ID must be a valid MongoDB ObjectId."
    });
  }

  if (typeof course !== "string" || course.trim() === "") {
    return res.status(400).json({
      message: "Course is required and cannot be empty"
    });
  }

  try {
    const student = await Student.findByIdAndUpdate(
      id,
      { course: course.trim() },
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    return res.status(200).json({
      message: "Course updated successfully",
      student
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    return res.status(500).json({
      message: "Internal server error"
    });
  }
});
```

`new: true` ensures the response contains the updated document rather than the one before the change. `runValidators: true` turns schema validation back on for this update — without it, Mongoose skips validation entirely on `findByIdAndUpdate`, so the `minlength` rule on `course` would never be checked. A course shorter than 2 characters now triggers a Mongoose `ValidationError`, which the `catch` block detects and responds to with `400`, instead of letting it fall through to a generic `500`.



### B4 — Unique email + required fields

```javascript
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: Number,
  email: { type: String, required: true, unique: true },
  phone: String,
  address: String,
  course: {
    type: String,
    minlength: [2, "Course must be at least 2 characters long"]
  },
  institution: String,
});
```

```javascript
app.post("/create-student", async (req, res) => {
  const { name, age, email, phone, address, course, institution } = req.body;
  try {
    const student = new Student({
      name, age, email, phone, address, course, institution,
    });
    await student.save();
    return res.status(201).json({ message: "Student created successfully", student });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: error.message
      });
    }

    return res.status(500).json({
      message: "Internal server error"
    });
  }
});
```

**Research note — `unique: true`:** Adding `unique: true` to a Mongoose schema path does not create a validator — it instructs MongoDB to build a unique index on that field. Enforcement happens at the database index level, not in Mongoose's validation layer, so a duplicate insert does not raise a `ValidationError`. Instead, MongoDB rejects the write and throws an error with `code: 11000`, its standard duplicate-key error code. This is why the `catch` block checks `error.code === 11000` as a separate case from `error.name === "ValidationError"`.

Missing `name` or `email` now triggers Mongoose's own `required: true` validation, which the `catch` block catches and responds to with `400` — rather than the previous behavior of silently saving a student with empty fields and returning `200`.



### B5 — Honest delete

This route now distinguishes between an invalid ID, a valid ID with no matching student, and a real, successful delete — instead of always reporting success.

```javascript
app.delete("/delete-student/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID. The ID must be a valid MongoDB ObjectId."
    });
  }

  try {
    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
      });
    }


    return res.status(200).json({ message: "Student deleted successfully", student });

        // 200 is used because we return a JSON confirmation message after the delete.

  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
});
```

`findByIdAndDelete` returns the deleted document if one was found and removed, or `null` if no document matched the ID. Checking for `null` means the route can correctly respond `404` for an ID that is valid in format but does not belong to any student — rather than the previous behavior, which always returned `200` even when nothing was actually deleted. `200` was chosen over `204` here specifically because the response includes a JSON body confirming which student was removed, rather than returning no content at all.