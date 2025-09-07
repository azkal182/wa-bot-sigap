import { jidNormalizedUser } from "@whiskeysockets/baileys";

/** Ambil hanya digit dari JID, mis. '62812xxx@s.whatsapp.net' -> '62812xxx' */
export function msisdnFromJid(jid: string): string {
  const norm = jidNormalizedUser(jid || "");
  const bare = norm.replace(/@.*/, "");
  return bare.replace(/[^\d]/g, "");
}

/** Normalisasi ke lokal Indonesia: +62/62/8xxxxx -> 08xxxxx */
export function toLocalIndonesian(msisdnLike: string): string {
  let d = (msisdnLike || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (d.startsWith("8")) d = "0" + d;
  else if (d.startsWith("0")) {
    // sudah lokal
  } else {
    // fallback: kalau bukan 62/8/0, biarkan apa adanya
  }
  // rapikan leading zero berlebih (misal '000812...' => '0812...')
  d = d.replace(/^0+/, "0");
  return d;
}

/** Ambil nomor lokal Indonesia langsung dari JID */
export function localNumberFromJid(jid: string): string {
  return toLocalIndonesian(msisdnFromJid(jid));
}
