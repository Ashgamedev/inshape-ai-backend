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

// ---- SAFETY CHECK ----
if (!process.env.GOOGLE_CREDENTIALS) {
  console.error("❌ GOOGLE_CREDENTIALS env variable missing");
  process.exit(1);
}

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// Google Auth
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

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);

// Health check
app.get("/", (req, res) => {
  res.send("Inshape AI Backend is running");
});

// Booking endpoint
app.post("/book", async (req, res) => {
  try {
    const { name, phone, service, date, time, email } = req.body;

    if (!name || !phone || !service || !date || !time) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // ---- Calendar event ----
    const event = {
      summary: `${service} - ${name}`,
      description: `Phone: ${phone}${email ? ` | Email: ${email}` : ""}`,
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

    // ---- Save to Sheets ----
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          name,
          phone,
          email || "",
          service,
          date,
          time,
          "Booked",
          "AI Agent",
          new Date().toISOString()
        ]]
      }
    });

    // ---- Email team ----
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: process.env.TEAM_EMAIL,
      subject: "New Free Trial Booking – Inshape Fitness",
      html: `
        <h3>New Booking Received</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Email:</b> ${email || "N/A"}</p>
        <p><b>Service:</b> ${service}</p>
        <p><b>Date:</b> ${date}</p>
        <p><b>Time:</b> ${time}</p>
      `
    });

    // ---- Email user ----
    if (email) {
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: "Your booking with Inshape Fitness is confirmed",
        html: `
          <h3>You're booked!</h3>
          <p>Hi ${name},</p>
          <p>Your <b>${service}</b> has been scheduled:</p>
          <p><b>Date:</b> ${date}</p>
          <p><b>Time:</b> ${time}</p>
          <p>We look forward to seeing you!</p>
          <p>- Inshape Fitness</p>
        `
      });
    }

    res.json({
      status: "success",
      eventId: calendarResponse.data.id
    });

  } catch (err) {
    console.error("Booking failed:", err);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

export default app;
