import fetch from "node-fetch";
import { logger } from "../utils/logger";

const TG_API_BASE = "https://api.telegram.org";

const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
const chatId = process.env.TELEGRAM_CHAT_ID ?? "";

export async function sendTelegramMessage(text: string) {
  if (!token || !chatId) {
    logger.warn(
      "Telegram token/chatId belum diset. Lewati pengiriman notifikasi."
    );
    return;
  }
  const url = `${TG_API_BASE}/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "Gagal kirim Telegram");
  } else {
    logger.info("Notifikasi terkirim ke Telegram");
  }
}
