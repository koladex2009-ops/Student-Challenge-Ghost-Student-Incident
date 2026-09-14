/*
## My answers

### A1 — get-student-by-name with duplicate Adas

`Student.find({ name })` returns all students that match the given name. Therefore, if two students are named Ada, the client receives an array containing both Ada student documents.

The JSON response would have this shape:


{
  "message": "Student fetched successfully",
  "student": [
    { "name": "Ada", "age": 20, "..." : "..." },
    { "name": "Ada", "age": 22, "..." : "..." }
  ]
}


The exact line from `app.js` that proves this is:



const student = await Student.find({ name });


The result is then sent in the `student` property by:


return res.status(200).json({ message: "Student fetched successfully", student });



`find()` is used when I want to retrieve all documents that match a condition. `findOne()` would return only one matching document, or `null` if no match exists. Therefore, I would use `find()` when multiple students with the same name should be returned, and `findOne()` when I only need one matching student.



### A2 — Case-insensitive name search

The current search is case-sensitive and requires an exact match because the code uses `Student.find({ name })`. Therefore, searching for `ada` will not match a student whose name is stored as `Ada`. Searching for `Ada ` with a trailing space will also not match because the extra space makes it a different string.

The exact line from `app.js` is:



const student = await Student.find({ name });


To make the search case-insensitive without fetching every student into Node.js, I can use MongoDB's `$regex` with the `i` option. MongoDB uses the `i` option to make regular-expression matching case-insensitive.

I can also use `trim()` to remove accidental spaces from the search input:



const student = await Student.find({
  name: { $regex: `^${name.trim()}$`, $options: "i" }
});


The `^` and `$` make the search an exact name match, while `i` makes it case-insensitive. `trim()` removes leading and trailing spaces from the value entered by the admin.

This approach lets MongoDB perform the search instead of fetching every student into Node.js and filtering them there.


### A3 — Updating a student

There are two possible reasons the admin may still see the old document.

First, she may be calling the endpoint incorrectly. One concrete way this happens: if she sends the PUT request without setting Content-Type: application/json, or if her request body in Postman is not set to "raw JSON," Express will not parse the body correctly. The line:

app.use(express.json());

only parses the body into req.body when the Content-Type header tells it the body is JSON. If that header is missing, req.body ends up empty ({}). When the route then destructures:

const { name, age, email, phone, address, course, institution } = req.body;

every one of these fields becomes undefined, because none of them exist on an empty object. So even though she typed a new age in the request body, the server never actually receives it.

The route also expects the student's ID as a URL parameter and the updated fields in the body, using the PUT method:

app.put("/update-student/:id", async (req, res) => {
const { id } = req.params;

If she sends the request as a GET or POST instead of PUT, or puts the ID in the body instead of the URL, the update would also fail silently or return an error, depending on what she actually sent.

Second, the Mongoose update options affect what is returned and validated. The current code already uses new: true, which tells Mongoose to return the document after the update rather than the old document:

{ new: true }

However, runValidators is not included. Update validators are disabled by default in Mongoose, so adding runValidators: true would make Mongoose validate the update against the schema.

The update currently sends all the fields:

{ name, age, email, phone, address, course, institution }

If a field is not provided in the request body, its value is undefined, and Mongoose removes undefined values from the update object before applying it, so that field simply remains unchanged in the database. This connects back to the first reason: a missing Content-Type header makes every field undefined, which produces the exact same symptom as this second issue, even though the causes are different.



### A4 — GET /get-student/:id

If the ObjectId is valid and the student exists, findById() returns the student's document, and the current code sends a 200 OK response.

The exact lines from app.js are:

const student = await Student.findById(id);

and:

return res.status(200).json({ message: "Student fetched successfully", student });

If the ObjectId is valid but the student does not exist, findById() returns null. It does not throw an error when no document is found.
Therefore, the current code still sends 200 OK, with student set to null.

For an invalid ID such as abc123, Mongoose tries to cast the ID to an ObjectId. A valid ObjectId is a 24-character hexadecimal string, and abc123 does not match that format, so Mongoose throws a CastError. The current catch block catches this error and sends a 500 Internal Server Error.

The exact lines that cause this are:

} catch (error) {
  return res.status(500).json({ message: "Internal server error" });
}

A CastError and a missing document are different problems. A CastError means the ID itself is invalid and cannot be converted to the required ObjectId type. A missing document means the ID is valid, but no student has that ID. Therefore, they should be handled separately: an invalid ID would normally receive 400 Bad Request, while a valid ID with no matching student would normally receive 404 Not Found.



### A5 — Actual MongoDB collection name

The actual MongoDB collection name is students, not Student.

The exact line from app.js is:

const Student = mongoose.model("Student", studentSchema);

Here, "Student" is the Mongoose model name. By default, Mongoose uses the model name to determine the collection name by pluralizing and lowercasing it. Therefore, the Student model uses the students collection.

The database being used is techSchoolApp, as shown in:

await mongoose.connect("mongodb://localhost:27017/techSchoolApp");

Therefore, the students are stored in:

techSchoolApp -> students

This matters when using MongoDB Compass or mongosh directly. If someone queries the wrong collection, such as:

db.Student.find()

they may see no documents and incorrectly think that the API is empty.
The correct raw MongoDB query would be:

db.students.find()

The API works because Mongoose automatically maps the Student model to the students collection.



### A6 — Content-Type and req.body

The line responsible for making req.body work is:

app.use(express.json());

This is Express middleware that parses incoming request bodies as JSON
and makes the parsed result available on req.body. It only does this
when the request's Content-Type header says application/json - Express
has no other way of knowing whether the raw bytes it received are JSON,
form data, or plain text.

The /create-student route gets the student information from req.body
here:

const { name, age, email, phone, address, course, institution } = req.body;

If the client forgets the Content-Type: application/json header,
express.json() skips parsing the body entirely, so req.body ends up as
an empty object ({}). As a result, every field destructured from it -
name, age, email, etc. - becomes undefined, and the student may be
saved with missing fields if the schema allows them.

A complete Postman request would be:
- Method: POST
- URL: http://localhost:1212/create-student
- Header: Content-Type: application/json
- Body -> raw -> JSON:

{
  "name": "Ada",
  "age": 20,
  "email": "ada@example.com",
  "phone": "08012345678",
  "address": "Lagos",
  "course": "Computer Science",
  "institution": "Tech School"
}

*/



const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const app = express();

const port = 1212;

app.use(express.json());
app.use(morgan("dev"));

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/techSchoolApp");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log(error);
  };
};

connectDB();

const studentSchema = new mongoose.Schema({
 name: {
    type: String,
    required: true
  },
  age: Number,
   email: {
    type: String,
    required: true,
    unique: true
  },
  phone: String,
  address: String,
  course: {
    type: String,
    minlength: [2, "Course must be at least 2 characters long"]
  },
  institution: String,
});

const Student = mongoose.model("Student", studentSchema);

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/create-student", async (req, res) => {
  const { name, age, email, phone, address, course, institution } = req.body;
  try {
    const student = new Student({
      name,
      age,
      email,
      phone,
      address,
      course,
      institution,
    });
    await student.save();
    return res.status(201).json({ message: "Student created successfully", student });
  } catch (error) {

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    };

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A student with this email already exists"
      });
    };

    return res.status(500).json({ 
      message: "Internal server error" 
    });
  };
});

app.get("/get-students", async (req, res) => {
  try {
    const students = await Student.find();
    return res.status(200).json({ message: "Students fetched successfully", students });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  };
});

app.get("/get-student/:id", async (req, res) => {
  const { id } = req.params;

  // isValid() only checks that the string has the correct shape (24 hexadecimal characters, or a few other formats Mongoose accepts) — it does not check whether a document with that ID actually exists. For example, "507f1f77bcf86cd799439011" is a well-formed ObjectId and passes isValid(), even if no student was ever created with that ID. That is why the separate "student not found" check below is still required.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID. The ID must be a valid MongoDB ObjectId."
    });
  };

  try {
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
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
  };
});

app.put("/update-student/:id", async (req, res) => {
  const { id } = req.params;
  const { name, age, email, phone, address, course, institution } = req.body;
  try {
    const student = await Student.findByIdAndUpdate(
      id,
      { name, age, email, phone, address, course, institution },
      { new: true }
    );
    return res.status(200).json({ message: "Student updated successfully", student });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  };
});

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
      {
        new: true,
        runValidators: true
      }
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

app.get("/get-student-by-name", async (req, res) => {
  const { name } = req.query;
  try {
    const student = await Student.find({ name });
    return res.status(200).json({ message: "Student fetched successfully", student });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  };
});

app.get("/search-students", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({
      message: "Search query q is required"
    });
  };

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
  };
});

app.delete("/delete-student/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student Id. The ID must be a valid MongoDB ObjectID."
    });
  };

  try {
    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
      });
    };

    return res.status(200).json({ message: "Student deleted successfully", student });
    // 200 is used because we return a JSON confirmation message after the delete.


  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  };
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});