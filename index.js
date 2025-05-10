require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
client.login(process.env.DISCORD_TOKEN);


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Welcome new members
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) {
    channel.send(`👋 Welcome to the server, ${member.user.tag}!`);
  }
});

// Announcement command
client.on('messageCreate', message => {
  if (message.content.startsWith('!announce')) {
    const text = message.content.slice('!announce'.length).trim();
    if (text.length > 0) {
      message.channel.send(`📢 Announcement: ${text}`);
    } else {
      message.channel.send("⚠️ Please provide an announcement message.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
