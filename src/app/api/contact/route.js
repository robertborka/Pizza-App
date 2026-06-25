import { NextResponse } from "next/server";
import { sendContactEmail } from "@/libs/email";

const CONTACT_RATE_LIMIT = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_MESSAGES = 5;
const MIN_FORM_TIME_MS = 2500;
const MAX_MESSAGE_LENGTH = 1500;
const MAX_SUBJECT_LENGTH = 120;

function cleanText(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(req) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.headers.get("x-real-ip") || "local";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = CONTACT_RATE_LIMIT.get(ip) || {
    count: 0,
    firstRequestAt: now,
  };

  if (now - record.firstRequestAt > RATE_LIMIT_WINDOW_MS) {
    CONTACT_RATE_LIMIT.set(ip, {
      count: 1,
      firstRequestAt: now,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_MESSAGES) {
    return false;
  }

  record.count += 1;
  CONTACT_RATE_LIMIT.set(ip, record);
  return true;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const honeypot = cleanText(body.website, 200);

    if (honeypot) {
      return NextResponse.json({ ok: true });
    }

    const startedAt = Number(body.startedAt || 0);

    if (startedAt && Date.now() - startedAt < MIN_FORM_TIME_MS) {
      return NextResponse.json(
        { error: "Mesajul a fost trimis prea repede. Te rugăm să încerci din nou." },
        { status: 429 }
      );
    }

    const ip = getClientIp(req);

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Au fost trimise prea multe mesaje. Te rugăm să încerci mai târziu." },
        { status: 429 }
      );
    }

    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 180).toLowerCase();
    const phone = cleanText(body.phone, 80);
    const subject = cleanText(body.subject, MAX_SUBJECT_LENGTH) || "Mesaj nou de pe site";
    const message = cleanText(body.message, MAX_MESSAGE_LENGTH);

    if (!name) {
      return NextResponse.json({ error: "Completează numele." }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Completează o adresă de email validă." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Scrie mesajul înainte să îl trimiți." },
        { status: 400 }
      );
    }

    await sendContactEmail({ name, email, phone, subject, message });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CONTACT_SEND_ERROR", error);

    return NextResponse.json(
      {
        error:
          "Mesajul nu a putut fi trimis momentan. Te rugăm să încerci din nou mai târziu.",
      },
      { status: 500 }
    );
  }
}
