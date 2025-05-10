require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,    // requires privileged intent
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent   // requires privileged intent
  ]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) channel.send(`👋 Welcome, ${member.user.tag}!`);
});

client.on('messageCreate', message => {
  if (message.content.startsWith('!announce')) {
    const announcement = message.content.slice('!announce'.length).trim();
    if (announcement.length) {
      message.channel.send(`📢 ${announcement}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
