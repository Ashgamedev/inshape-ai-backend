import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { google } from "googleapis";
import { Resend } from "resend";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ======================
   ENV SAFETY CHECKS
====================== */

const requiredEnvs = [
  "GOOGLE_CREDENTIALS",
  "CALENDAR_ID",
  "TIMEZONE",
  "RESEND_API_KEY"
];

for (const key of requiredEnvs) {
  if (!process.env[key]) {
    console.error(`❌ Missing env variable: ${key}`);
    process.exit(1);
  }
}

/* ======================
   GOOGLE SETUP
====================== */

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
const sheets = google.sheets({ version: "v4", auth });

const SHEET_ID = "1g9Ga2sE-zZC8I8aYNMWY6S6YJ_7586PIP-g0CAacIvU";

/* ======================
   EMAIL SETUP
====================== */

const resend = new Resend(process.env.RESEND_API_KEY);

/* ======================
   ROUTES
====================== */

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

    /* ---- Create Calendar Event ---- */

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

    const calendarResponse = await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      resource: event
    });

    const eventId = calendarResponse.data.id;

    /* ---- Save to Google Sheets ---- */

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          name,
          phone,
          "",
          service,
          date,
          time,
          "Booked",
          "AI Voice Agent",
          new Date().toISOString()
        ]]
      }
    });

    /* ---- Send Email ---- */

    const emailResult = await resend.emails.send({
      from: "onboarding@resend.dev",   // IMPORTANT: safe sender
      to: "YOUR_EMAIL@gmail.com",       // replace with your email for now
      subject: "New Inshape Fitness Booking",
      html: `
        <h3>New Booking Confirmed</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Event ID:</strong> ${eventId}</p>
      `
    });

    console.log("📧 Email sent:", emailResult);

    res.json({
      status: "success",
      eventId
    });

  } catch (err) {
    console.error("❌ Booking failed:", err);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

export default app;
