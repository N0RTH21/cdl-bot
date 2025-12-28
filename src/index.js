import dotenv from "dotenv";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { startHealthServer } from "./server.js";

dotenv.config();

// 🌐 Health server (Renderhez kötelező)
startHealthServer(process.env.PORT || 3000);

// 🤖 Discord kliens
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ⏱️ Frissítés ideje (másodperc)
const UPDATE_INTERVAL = Number(process.env.UPDATE_INTERVAL_SEC || 900);

// 📍 ID-k (a te adataid)
const GUILD_ID = "1125113364675309689";
const CHANNEL_ID = "1449871018360311848";

// 🌐 CDL standings lekérés
async function fetchStandings() {
  const url = "https://cod-esports.fandom.com/wiki/Call_of_Duty_League/2025_Season";
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const table = $("table").first();
  const rows = [];

  table.find("tr").each((i, el) => {
    if (i === 0) return;
    const cols = $(el).find("td").map((_, td) => $(td).text().trim()).get();
    if (cols.length >= 3) {
      rows.push({
        rank: cols[0],
        team: cols[1],
        pts: cols[cols.length - 1],
      });
    }
  });

  return rows.slice(0, 12);
}

// 📦 Embed (szép üzenet)
function createEmbed(rows) {
  const desc = rows.length
    ? rows.map(r => `**${r.rank}.** ${r.team} — **${r.pts} pts**`).join("\n")
    : "⚠️ Most nem tudtam beolvasni a standings adatokat (üres táblázat). Próbálom újra frissítéskor.";

  return new EmbedBuilder()
    .setTitle("🏆 CDL Standings (auto frissül)")
    .setDescription(desc)
    .setColor(0x00ffff)
    .setTimestamp();

}

// 📨 Dashboard frissítés
let messageId = null;

async function updateDashboard() {
  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(CHANNEL_ID);

  const standings = await fetchStandings();
  const embed = createEmbed(standings);

  if (messageId) {
    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {}
  }

  const sent = await channel.send({ embeds: [embed] });
  messageId = sent.id;
}

// 🚀 Bot indítása
client.once("ready", async () => {
  console.log(`Bot elindult: ${client.user.tag}`);
  await updateDashboard();
  setInterval(updateDashboard, UPDATE_INTERVAL * 1000);
});

client.login(process.env.DISCORD_TOKEN);
