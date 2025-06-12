require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const getPnrStatus = require("./pnrScraper");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SERVER_URL = process.env.BASE_URL; // Example: https://pnr-tracker.onrender.com
const PORT = process.env.PORT || 3000;

// Initialize bot with webhook
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  webHook: { port: PORT },
});
bot.setWebHook(`${SERVER_URL}/bot${TELEGRAM_BOT_TOKEN}`);

// Express server to handle webhook
const app = express();
app.use(express.json());

app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("🚄 PNR Tracker Bot is running.");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ===============================
// PNR Bot Logic
// ===============================

let userSession = {
  chatId: null,
  pnr: null,
  lastStatus: "",
};

// Handle user message (PNR input)
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (/^\d{10}$/.test(text)) {
    userSession.chatId = chatId;
    userSession.pnr = text;
    userSession.lastStatus = "";

    await bot.sendMessage(chatId, `✅ Got your PNR: ${text}. I will notify you if status changes.`, {
      reply_markup: {
        inline_keyboard: [[{ text: "🔄 Refresh Now", callback_data: "refresh_pnr" }]],
      },
    });

    // Check immediately
    await checkPnr();
  } else {
    bot.sendMessage(chatId, "🔢 Please send a valid 10-digit PNR number.");
  }
});

// Handle refresh button
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "refresh_pnr") {
    if (!userSession.pnr) {
      return bot.sendMessage(chatId, "❌ No PNR session found. Please send your 10-digit PNR.");
    }

    bot.answerCallbackQuery(callbackQuery.id, { text: "🔄 Refreshing..." });

    try {
      const statusLines = await getPnrStatus(userSession.pnr);
      const newStatus = statusLines.join("\n");

      await bot.sendMessage(chatId, `🔄 Refreshed PNR Status:\n${newStatus}`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🔄 Refresh Again", callback_data: "refresh_pnr" }]],
        },
      });

      userSession.lastStatus = newStatus;
    } catch (err) {
      console.error("❌ Refresh Error:", err.message);
      bot.sendMessage(chatId, "❌ Could not refresh status. Try again later.");
    }
  }
});

// Check PNR and notify if changed
async function checkPnr() {
  const { chatId, pnr, lastStatus } = userSession;
  if (!chatId || !pnr) return;

  try {
    const statusLines = await getPnrStatus(pnr);
    const newStatus = statusLines.join("\n");

    if (newStatus !== lastStatus) {
      await bot.sendMessage(chatId, `🔔 PNR ${pnr} status updated:\n${newStatus}`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "refresh_pnr" }]],
        },
      });
      userSession.lastStatus = newStatus;
    } else {
      console.log("✅ No change in PNR status.");
    }
  } catch (error) {
    console.error("❌ Error checking PNR:", error.message);
    bot.sendMessage(chatId, "❌ " + error.message);
  }
}
