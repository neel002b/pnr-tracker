require("dotenv").config();
const getPnrStatus = require("./pnrScraper");
const TelegramBot = require("node-telegram-bot-api");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

let userSession = {
  chatId: null,
  pnr: null,
  lastStatus: "",
  lastPassengerStatuses: []  // NEW: Track each passenger's current status
};

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (/^\d{10}$/.test(text)) {
    userSession.chatId = chatId;
    userSession.pnr = text;
    userSession.lastStatus = "";

    bot.sendMessage(chatId, `✅ Got your PNR: ${text}. I will notify you if status changes.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh Now", callback_data: "refresh_pnr" }]
        ]
      }
    });

    // Run immediately
    await checkPnr();

  } else {
    bot.sendMessage(chatId, "🔢 Please send a valid 10-digit PNR number.");
  }
});

// ✅ Refresh Button Logic
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "refresh_pnr") {
    if (!userSession.pnr) {
      return bot.sendMessage(chatId, "❌ No PNR session found. Send your 10-digit PNR again.");
    }

    bot.answerCallbackQuery(callbackQuery.id, { text: "Refreshing..." });

    try {
      const statusLines = await getPnrStatus(userSession.pnr);
      const newStatus = statusLines.join("\n");

      await bot.sendMessage(chatId, `🔄 Refreshed PNR Status:\n${newStatus}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Refresh Again", callback_data: "refresh_pnr" }]
          ]
        }
      });

      userSession.lastStatus = newStatus;
    } catch (err) {
      console.error("❌ Refresh Error:", err.message);
      bot.sendMessage(chatId, "❌ Could not refresh status. Try again.");
    }
  }
});

// ✅ Auto Check Logic
async function checkPnr() {
  const { chatId, pnr, lastStatus } = userSession;
  if (!chatId || !pnr) return;

  try {
    const statusLines = await getPnrStatus(pnr);
    const newStatus = statusLines.join("\n");

    if (newStatus !== lastStatus) {
      await bot.sendMessage(chatId, `🔔 PNR ${pnr} status updated:\n${newStatus}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: "refresh_pnr" }]
          ]
        }
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
