import "dotenv/config";
import { logger } from "./utils/logger";
import { startWhatsApp } from "./bot/whatsapp";

async function main() {
  logger.info(`🚀 ${process.env.APP_NAME ?? "WA-Bot"} starting...`);
  await startWhatsApp();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
