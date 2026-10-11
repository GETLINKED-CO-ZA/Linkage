export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "office@getlinked.co.za";
  const recipientEmail = process.env.BREVO_RECIPIENT_EMAIL || "linkage@getlinked.co.za";

  if (!apiKey) return res.status(500).json({ error: "Email service is not configured yet." });

  try {
    const body = req.body || {};
    const firstName = clean(body.firstName, 80);
    const surname = clean(body.surname, 80);
    const age = Number(body.age);
    const story = clean(body.story, 160);
    const comment = clean(body.comment, 1200);
    const consent = body.consent === true;

    if (!firstName || !surname || !Number.isInteger(age) || age < 1 || age > 120 || !consent) {
      return res.status(400).json({ error: "Please check your name, surname, age and consent." });
    }

    const text = [
      "NEW READER’S VOICE SUBMISSION — THE LINKAGE MAGAZINE",
      "",
      `Name: ${firstName} ${surname}`,
      `Age: ${age}`,
      `Favourite story: ${story || "Not provided"}`,
      "",
      "Reader comment:",
      comment || "No comment provided.",
      "",
      "Consent confirmed in the submission form.",
      `Received: ${new Date().toISOString()}`
    ].join("\n");

    const email = {
      sender: { name: "The Linkage Magazine — Reader’s Voice", email: senderEmail },
      to: [{ email: recipientEmail, name: "The Linkage Editorial Team" }],
      subject: `Reader’s Voice submission — ${firstName} ${surname}`,
      textContent: text
    };

    if (body.photo) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const fileName = clean(body.photo.name || "reader-photo", 120).replace(/[^a-zA-Z0-9._-]/g, "_");
      const type = body.photo.type;
      const data = body.photo.data;
      if (!allowedTypes.includes(type) || typeof data !== "string" || data.length > 4_300_000 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
        return res.status(400).json({ error: "The photo could not be processed. Please upload a valid image up to 3 MB." });
      }
      email.attachment = [{ name: fileName, content: data }];
    }

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(email)
    });

    if (!brevoResponse.ok) {
      const details = await brevoResponse.text();
      console.error("Brevo email request failed:", brevoResponse.status, details);
      return res.status(502).json({ error: "The email service could not accept your submission. Please try again later." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Submission handler error:", error);
    return res.status(500).json({ error: "Something went wrong while sending your submission." });
  }
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, maxLength) : "";
}
