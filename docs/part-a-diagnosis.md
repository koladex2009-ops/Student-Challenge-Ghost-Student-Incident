## Part A — Diagnosis

### A1 — get-student-by-name with duplicate Adas

`Student.find({ name })` returns all students that match the given name. Therefore, if two students are named Ada, the client receives an array containing both Ada student documents.

The JSON response would have this shape:


```json
{
  "message": "Student fetched successfully",
  "student": [
    { "name": "Ada", "age": 20, "..." : "..." },
    { "name": "Ada", "age": 22, "..." : "..." }
  ]
}
```


The exact line from `app.js` that proves this is:



```javascript
const student = await Student.find({ name });
```


The result is then sent in the `student` property by:


```javascript
return res.status(200).json({ message: "Student fetched successfully", student });
```


`find()` is used when I want to retrieve all documents that match a condition. `findOne()` would return only one matching document, or `null` if no match exists. Therefore, I would use `find()` when multiple students with the same name should be returned, and `findOne()` when I only need one matching student.



### A2 — Case-insensitive name search

The current search is case-sensitive and requires an exact match because the code uses `Student.find({ name })`. Therefore, searching for `ada` will not match a student whose name is stored as `Ada`. Searching for `Ada ` with a trailing space will also not match because the extra space makes it a different string.

The exact line from `app.js` is:


```javascript
const student = await Student.find({ name });
```

To make the search case-insensitive without fetching every student into Node.js, I can use MongoDB's `$regex` with the `i` option. MongoDB uses the `i` option to make regular-expression matching case-insensitive.

I can also use `trim()` to remove accidental spaces from the search input:


```javascript
const student = await Student.find({
  name: { $regex: `^${name.trim()}$`, $options: "i" }
});
```


The `^` and `$` make the search an exact name match, while `i` makes it case-insensitive. `trim()` removes leading and trailing spaces from the value entered by the admin.

This approach lets MongoDB perform the search instead of fetching every student into Node.js and filtering them there.



### A3 — Updating a student

There are two possible reasons the admin may still see the old document.

**First, she may be calling the endpoint incorrectly.** The route expects the student's ID as a URL parameter and expects the other student information in the request body. The HTTP method must also be `PUT`.

The exact lines from `app.js` are:

```javascript
app.put("/update-student/:id", async (req, res) => {
```

and:

```javascript
const { id } = req.params;
```

The other fields are taken from the request body:

```javascript
const { name, age, email, phone, address, course, institution } = req.body;
```

Therefore, the request should look like `PUT /update-student/:id`, with the student's ID in the URL and the fields to update in the body.

One concrete way this goes wrong: if she sends the request without setting `Content-Type: application/json`, or her request body in Postman is not set to "raw JSON," Express will not parse the body correctly. The line `app.use(express.json());` only fills in `req.body` when this header says the body is JSON. If it's missing, `req.body` ends up empty (`{}`), which means `name`, `age`, `email`, and every other destructured field become `undefined` — even though she typed a new age into the request. The server simply never receives it.

**Second, the Mongoose update options affect what is returned and validated.** The current code already uses `new: true`, which tells Mongoose to return the document after the update rather than the old document.

The exact line from `app.js` is:

```javascript
{ new: true }
```

However, `runValidators` is not included. Update validators are disabled by default, so adding `runValidators: true` would make Mongoose validate the update against the schema.

The update currently sends all the fields:

```javascript
{ name, age, email, phone, address, course, institution }
```

If a field is not provided in the request body, its value is `undefined`, and Mongoose removes `undefined` values from the update, so that field remains unchanged. This is the same symptom caused by the missing `Content-Type` header above — different cause, identical result.

**Verified while testing:** Sending a PUT request to `/update-student/:id` with fields that don't match the Student schema (for example, `title`, `author`, `year`, `available` — which belong to a different project's Book model) reproduced this exact symptom. The response returned `200 OK` with the student's original, unchanged values, because every destructured field (`name`, `age`, `email`, etc.) came out `undefined` and was stripped before the update was applied.



### A4 — GET /get-student/:id

If the ObjectId is valid and the student exists, `findById()` returns the student's document, and the current code sends a 200 OK response.

The exact lines from `app.js` are:

```javascript
const student = await Student.findById(id);
```

and:

```javascript
return res.status(200).json({ message: "Student fetched successfully", student });
```

If the ObjectId is valid but the student does not exist, `findById()` returns `null`. It does not throw an error when no document is found. Therefore, the current code still sends 200 OK, with `student` set to `null`.

For an invalid ID such as `abc123`, Mongoose tries to cast the ID to an ObjectId. A valid ObjectId is a 24-character hexadecimal string, and `abc123` does not match that format, so Mongoose throws a `CastError`. The current `catch` block catches this error and sends a 500 Internal Server Error.

The exact lines that cause this are:

```javascript
} catch (error) {
  return res.status(500).json({ message: "Internal server error" });
}
```

A `CastError` and a missing document are different problems. A `CastError` means the ID itself is invalid and cannot be converted to the required ObjectId type. A missing document means the ID is valid, but no student has that ID. Therefore, they should be handled separately: an invalid ID would normally receive 400 Bad Request, while a valid ID with no matching student would normally receive 404 Not Found.



### A5 — Actual MongoDB collection name

The actual MongoDB collection name is **`students`**, not `Student`.

The exact line from `app.js` is:

```javascript
const Student = mongoose.model("Student", studentSchema);
```

Here, `"Student"` is the Mongoose model name. By default, Mongoose uses the model name to determine the collection name by pluralizing and lowercasing it. Therefore, the `Student` model uses the **`students`** collection.

The database being used is `techSchoolApp`, as shown in:

```javascript
await mongoose.connect("mongodb://localhost:27017/techSchoolApp");
```

Therefore, the students are stored in:

```text
techSchoolApp → students
```

This matters when using MongoDB Compass or `mongosh` directly. If someone queries the wrong collection, such as:

```javascript
db.Student.find()
```

they may see no documents and incorrectly think that the API is empty. The correct raw MongoDB query would be:

```javascript
db.students.find()
```

The API works because Mongoose automatically maps the `Student` model to the `students` collection.

**Verified in MongoDB Compass:** the `techSchoolApp` database contains a collection named `students` (not `Student`), confirming Mongoose's automatic pluralization.



### A6 — Content-Type and req.body

The line responsible for making `req.body` work is:

```javascript
app.use(express.json());
```

This is Express middleware that parses incoming request bodies as JSON and makes the parsed result available on `req.body`. It only does this when the request's `Content-Type` header says `application/json` — Express has no other way of knowing whether the raw bytes it received are JSON, form data, or plain text.

The `/create-student` route gets the student information from `req.body` here:

```javascript
const { name, age, email, phone, address, course, institution } = req.body;
```

If the client forgets the `Content-Type: application/json` header, `express.json()` skips parsing the body entirely, so `req.body` ends up as an empty object (`{}`). As a result, every field destructured from it — `name`, `age`, `email`, etc. — becomes `undefined`, and the student may be saved with missing fields if the schema allows them.

A complete Postman request would be:

- Method: `POST`
- URL: `http://localhost:1212/create-student`
- Header: `Content-Type: application/json`
- Body → raw → JSON:

```json
{
  "name": "Ada",
  "age": 20,
  "email": "ada@example.com",
  "phone": "08012345678",
  "address": "Lagos",
  "course": "Computer Science",
  "institution": "Tech School"
}
```
