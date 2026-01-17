import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load Google credentials
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
);

const calendar = google.calendar({ version: "v3", auth });

app.get("/", (req, res) => {
  res.send("Inshape AI Backend is running");
});

app.post("/book", async (req, res) => {
  try {
    const { name, phone, service, date, time } = req.body;

    if (!name || !phone || !service || !date || !time) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const event = {
      summary: `${service} - ${name}`,
      description: `Phone: ${phone}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: process.env.TIMEZONE
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: process.env.TIMEZONE
      }
    };

    const response = await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      resource: event
    });

    res.json({
      status: "success",
      eventId: response.data.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

export default app;
