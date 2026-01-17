import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Inshape AI Backend is running");
});

// Placeholder endpoints
app.post("/book", (req, res) => {
  res.json({ status: "ok", message: "Booking endpoint reached" });
});

app.post("/reschedule", (req, res) => {
  res.json({ status: "ok", message: "Reschedule endpoint reached" });
});

app.post("/cancel", (req, res) => {
  res.json({ status: "ok", message: "Cancel endpoint reached" });
});

app.post("/save-lead", (req, res) => {
  res.json({ status: "ok", message: "Lead saved endpoint reached" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
