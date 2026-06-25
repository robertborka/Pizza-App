import nodemailer from "nodemailer";
import { formatMoney } from "./formatters";
import { restaurantInfo } from "./restaurantInfo";

function cleanText(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

export function escapeHtml(value) {
  return cleanText(value, 8000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br />");
}

function getMailConfig() {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = cleanText(process.env.SMTP_USER, 180);
  const smtpPass = cleanText(process.env.SMTP_PASS, 400);
  const contactEmailTo =
    cleanText(process.env.CONTACT_EMAIL_TO, 180) || restaurantInfo.email;

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    contactEmailTo,
  };
}

export function hasMailConfig() {
  const { smtpUser, smtpPass } = getMailConfig();
  return Boolean(smtpUser && smtpPass);
}

export function createMailTransporter() {
  const { smtpHost, smtpPort, smtpUser, smtpPass } = getMailConfig();

  if (!smtpUser || !smtpPass) {
    throw new Error("Configurarea pentru trimiterea emailurilor lipsește.");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

export function getDefaultMailSender() {
  const { smtpUser } = getMailConfig();
  return `Top Family Pizza <${smtpUser}>`;
}

export function getContactRecipient() {
  return getMailConfig().contactEmailTo;
}

export async function sendContactEmail({ name, email, phone, subject, message }) {
  const transporter = createMailTransporter();
  const recipient = getContactRecipient();

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || "Nespecificat");
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);

  await transporter.sendMail({
    from: getDefaultMailSender(),
    to: recipient,
    replyTo: `${name} <${email}>`,
    subject: `[Top Family Pizza] ${subject}`,
    text: [
      `Nume: ${name}`,
      `Email: ${email}`,
      `Telefon: ${phone || "Nespecificat"}`,
      `Subiect: ${subject}`,
      "",
      message,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;background:#fff7ed;padding:24px">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:22px;padding:24px;border:1px solid #fed7aa">
          <h2 style="margin:0 0 16px;color:#f13a01">Mesaj nou de pe site</h2>
          <p><strong>Nume:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Telefon:</strong> ${safePhone}</p>
          <p><strong>Subiect:</strong> ${safeSubject}</p>
          <div style="margin-top:18px;padding:18px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa">
            ${safeMessage}
          </div>
        </div>
      </div>
    `,
  });
}

function shortOrderId(orderId) {
  return `#${String(orderId || "").slice(-6).toUpperCase()}`;
}

function getProductLine(product) {
  const quantity = Number(product?.quantity || 1);
  const unitPrice = Number(product?.price ?? product?.basePrice ?? 0);
  const lineTotal = Number(product?.lineTotal ?? quantity * unitPrice);

  return {
    name: product?.name || "Produs",
    quantity,
    unitPrice,
    lineTotal,
  };
}

export async function sendNewOrderEmail(order) {
  const transporter = createMailTransporter();
  const recipient = getContactRecipient();
  const orderId = shortOrderId(order?._id);
  const products = Array.isArray(order?.products) ? order.products : [];
  const productLines = products.map(getProductLine);
  const total = Number(order?.totalPrice || 0);
  const customerName = cleanText(order?.customerName) || "Client";
  const phone = cleanText(order?.phone) || "Nespecificat";
  const city = cleanText(order?.city) || "-";
  const address = cleanText(order?.address) || "Adresă nespecificată";
  const notes = cleanText(order?.notes, 1500);

  const textProducts = productLines
    .map((product) => {
      return `${product.quantity} x ${product.name} - ${formatMoney(product.lineTotal)}`;
    })
    .join("\n");

  const htmlProducts = productLines
    .map((product) => {
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6"><strong>${escapeHtml(product.quantity)} x ${escapeHtml(product.name)}</strong></td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right">${escapeHtml(formatMoney(product.lineTotal))}</td>
        </tr>
      `;
    })
    .join("");

  await transporter.sendMail({
    from: getDefaultMailSender(),
    to: recipient,
    subject: `Comandă nouă ${orderId}`,
    text: [
      `Comandă nouă ${orderId}`,
      `Client: ${customerName}`,
      `Telefon: ${phone}`,
      `Oraș: ${city}`,
      `Adresă: ${address}`,
      notes ? `Observații: ${notes}` : "",
      "",
      "Produse:",
      textProducts || "-",
      "",
      `Total: ${formatMoney(total)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;background:#fff7ed;padding:24px">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:22px;padding:24px;border:1px solid #fed7aa">
          <p style="margin:0 0 8px;color:#f13a01;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Comandă nouă</p>
          <h2 style="margin:0 0 18px;color:#111827">${escapeHtml(orderId)}</h2>
          <div style="display:grid;gap:8px;margin-bottom:20px">
            <p style="margin:0"><strong>Client:</strong> ${escapeHtml(customerName)}</p>
            <p style="margin:0"><strong>Telefon:</strong> ${escapeHtml(phone)}</p>
            <p style="margin:0"><strong>Oraș:</strong> ${escapeHtml(city)}</p>
            <p style="margin:0"><strong>Adresă:</strong> ${escapeHtml(address)}</p>
            ${notes ? `<p style="margin:0"><strong>Observații:</strong> ${escapeHtml(notes)}</p>` : ""}
          </div>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tbody>${htmlProducts}</tbody>
          </table>
          <div style="margin-top:18px;padding:16px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;text-align:right">
            <span style="display:block;color:#6b7280;font-size:14px">Total comandă</span>
            <strong style="font-size:26px;color:#f13a01">${escapeHtml(formatMoney(total))}</strong>
          </div>
        </div>
      </div>
    `,
  });
}
