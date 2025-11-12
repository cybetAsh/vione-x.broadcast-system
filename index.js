const express = require("express");
const bodyParser = require("body-parser");
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

let sock;
let isConnected = false;

// WhatsApp Connect via Pair Code
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("sessions");
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: ["VIONE X", "Chrome", "10.0"]
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection } = update;
    if (connection === "open") {
      isConnected = true;
      console.log("✅ WhatsApp Connected Successfully!");
    } else if (connection === "close") {
      console.log("🔄 Disconnected. Reconnecting...");
      isConnected = false;
      connectToWhatsApp();
    }
  });

  return sock;
}

connectToWhatsApp();

// Generate Pair Code endpoint
app.post("/pair", async (req, res) => {
  const { number } = req.body;
  if (!number) return res.json({ error: "Phone number required!" });

  try {
    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";
    const code = await sock.requestPairingCode(number);
    res.json({ pairCode: code });
  } catch (err) {
    res.json({ error: "Failed to generate pair code: " + err.message });
  }
});

// Send Message endpoint
app.post("/send", async (req, res) => {
  const { groupLink, message } = req.body;
  try {
    const inviteCode = groupLink.split("invite/")[1];
    const group = await sock.groupAcceptInvite(inviteCode);
    await sock.sendMessage(group, { text: message });
    res.json({ msg: "✅ Message sent successfully!" });
  } catch (err) {
    res.json({ error: "❌ Failed: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));