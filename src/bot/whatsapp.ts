import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import { logger } from "../utils/logger";
import { sendTelegramMessage } from "./telegram";
import { handleBasicCommands, parseText } from "./handlers";
import QRCode from "qrcode";

export async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const { version } = await fetchLatestBaileysVersion();
  logger.info({ version }, "Using WA version");

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: 60_000,
  });

  sock.ev.process(async (events) => {
    if (events["creds.update"]) {
      await saveCreds();
    }

    if (events["connection.update"]) {
      const { connection, lastDisconnect, qr } = events["connection.update"];
      if (qr) {
        logger.info("QR diterbitkan. Scan menggunakan WhatsApp.");
        console.log(await QRCode.toString(qr, { type: "terminal" }));
      }
      if (connection === "open") {
        logger.info("✅ Tersambung ke WhatsApp");
        await sendTelegramMessage(
          `✅ <b>${process.env.APP_NAME ?? "WA-Bot"}</b> tersambung ke WhatsApp`
        );
      } else if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        logger.warn({ statusCode }, "Koneksi tertutup");

        if (statusCode === DisconnectReason.loggedOut) {
          logger.error("❌ Logged out dari WhatsApp!");
          await sendTelegramMessage(
            `❌ <b>${
              process.env.APP_NAME ?? "WA-Bot"
            }</b> <u>LOGGED OUT</u> dari WhatsApp. Perlu scan ulang QR.`
          );
          // ketika logged out, jangan auto-reconnect. Biarkan user scan ulang.
          return;
        }
        // auto-reconnect untuk kasus selain logged out
        logger.info("Mencoba reconnect...");
        setTimeout(
          () =>
            startWhatsApp().catch((err) =>
              logger.error(err, "Reconnect gagal")
            ),
          1500
        );
      }
    }

    if (events["messages.upsert"]) {
      const upsert = events["messages.upsert"];
      for (const m of upsert.messages) {
        const msg = m.message;
        const from = jidNormalizedUser(m.key.remoteJid ?? "");
        if (!msg || m.key.fromMe) continue;

        // JID tujuan balas (chat, bisa grup/privat)
        const chatJid = jidNormalizedUser(m.key.remoteJid ?? "");
        // JID pengirim (kalau grup gunakan participant, kalau privat gunakan remoteJid)
        const senderJid = jidNormalizedUser(
          m.key.participant ?? m.key.remoteJid ?? ""
        );
        const text = parseText(msg);
        const reply = async (content: string) => {
          await sock.sendMessage(from, { text: content }, { quoted: m });
        };

        if (text) {
          const handled = await handleBasicCommands(text, reply, { senderJid });
          if (!handled) {
            // default: abaikan / atau balas template singkat
            // await reply('Ketik *help* untuk daftar perintah.')
          }
        }
      }
    }
  });

  return sock;
}
