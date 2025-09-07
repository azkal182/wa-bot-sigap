import type { proto } from "@whiskeysockets/baileys";
import { logger } from "../utils/logger";
import { localNumberFromJid } from "../utils/phone";

// Konfigurasi endpoint (boleh dioverride via env)
const API_BASE = process.env.WABOT_API_BASE ?? "http://localhost:3000";
const INFO_URL = `${API_BASE}/api/wabot/info`;
const RESET_URL = `${API_BASE}/api/wabot/reset`;

type InfoResp = { data?: { name?: string; username?: string } };
type ResetResp = {
  message?: string;
  data?: { name?: string; username?: string };
};

export function parseText(
  msg: proto.IMessage | null | undefined
): string | null {
  if (!msg) return null;
  // prioritaskan conversation & extendedTextMessage
  const conv = msg.conversation ?? msg.extendedTextMessage?.text ?? null;
  return conv ?? null;
}

type CommandOpts = { senderJid?: string };

export async function handleBasicCommands(
  text: string,
  reply: (content: string) => Promise<void>,
  opts?: CommandOpts
) {
  const t = text.trim();
  if (/^ping$/i.test(t)) {
    await reply("pong 🏓");
    return true;
  }
  if (/^help$/i.test(t)) {
    await reply(
      [
        "🤖 *Menu*",
        "- `info` → Informasi akun Anda",
        "- `reset` → Reset akun Anda (jika bermasalah)",
        "- `help` → tampilkan ini",
      ].join("\n")
    );
    return true;
  }
  const echo = t.match(/^echo\s+(.+)/i);
  if (echo) {
    await reply(echo[1]);
    return true;
  }

  // nomor (support variasi prefix / ! #)
  if (/^(?:[\/#!])?\s*nomor$/i.test(t)) {
    const local = opts?.senderJid ? localNumberFromJid(opts.senderJid) : "";
    if (local) {
      await reply(`Nomor Anda: ${local}`);
    } else {
      await reply("Maaf, nomor tidak dapat diidentifikasi.");
    }
    return true;
  }

  // ===== INFO =====
  if (/^(?:[\/#!])?\s*info$/i.test(t)) {
    const phone = opts?.senderJid ? localNumberFromJid(opts.senderJid) : "";
    if (!phone) {
      await reply("Gagal: nomor pengirim tidak dikenali.");
      return true;
    }

    try {
      const url = new URL(INFO_URL);
      url.searchParams.set("phone_whatsapp", phone); // ex: 087833372003

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      // --- Handling khusus 404 ---
      if (res.status === 404) {
        await reply(
          "Nomor belum terdaftar, harap daftarkan terlebih dahulu atau hubungi operator."
        );
        return true;
      }

      if (!res.ok) {
        await reply(`Gagal mengambil info (HTTP ${res.status}).`);
        return true;
      }

      const json = (await res.json()) as InfoResp;
      const name = json?.data?.name;
      const username = json?.data?.username;

      if (name || username) {
        await reply(
          [
            "📄 *Info Akun*",
            name ? `- Nama: ${name}` : null,
            username ? `- Username: ${username}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        );
      } else {
        await reply("Info tidak tersedia pada respons SIGAP.");
      }
    } catch (err) {
      logger.error(err, "Fetch info failed");
      await reply("Gagal mengambil info dari SIGAP.");
    }
    return true;
  }

  // ===== RESET =====
  if (/^(?:[\/#!])?\s*reset$/i.test(t)) {
    const phone = opts?.senderJid ? localNumberFromJid(opts.senderJid) : "";
    if (!phone) {
      await reply("Gagal: nomor pengirim tidak dikenali.");
      return true;
    }

    try {
      const url = new URL(RESET_URL);
      url.searchParams.set("phone_whatsapp", phone);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      // --- Handling khusus 404 ---
      if (res.status === 404) {
        await reply(
          "Nomor belum terdaftar, harap daftarkan terlebih dahulu atau hubungi operator."
        );
        return true;
      }

      if (!res.ok) {
        await reply(`Gagal melakukan reset (HTTP ${res.status}).`);
        return true;
      }

      const json = (await res.json()) as ResetResp;
      // Kirim hanya pesan dari API bila ada
      if (json?.message) {
        await reply(json.message);
      } else {
        await reply("Reset berhasil.");
      }
    } catch (err) {
      logger.error(err, "Fetch reset failed");
      await reply("Gagal melakukan reset via SIGAP.");
    }
    return true;
  }

  logger.debug({ t }, "No basic command matched");
  return false;
}
