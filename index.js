require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');

// === COLOR THEME ROTATION ===
const colorThemes = [0xFFD700, 0x00BFFF, 0x8A2BE2, 0xFF69B4, 0x32CD32];
const getRandomColor = () => colorThemes[Math.floor(Math.random() * colorThemes.length)];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the server like a boss 😎', type: ActivityType.Watching }],
    status: 'online'
  });
});

// === WELCOME MESSAGE HANDLER ===
function sendWelcomeMessage(member, targetChannel) {
  const embed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setTitle(`💎 Welcome to the Family, ${member.user.username}! 💎`)
    .setDescription(`
**Yo, ${member.user.username}, you've just rolled up to the hottest spot in town!** 😎  
We're hyped to have you here in **${member.guild.name}**. This joint’s where style meets hustle, and you're right on time. 🍸

🔑 **First move? Slide over to <#holder-verification> to verify and claim your roles.** No pass, no status — you know how it goes. 💼  

**Here's your VIP guide:**
• Check the rules – Know the game before you play. 📜  
• Introduce yourself – Step in, let us know who just arrived. 💬  
• Get involved – We’re always making moves. Stay sharp. 🔥

You’re now part of the crew — **#${member.guild.memberCount}** strong. Time to flex, vibe, and leave your mark. 💯

Welcome to the club, boss. 😏
    `)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member #${member.guild.memberCount} – Leveling up daily.` })
    .setTimestamp();

  targetChannel.send({ embeds: [embed] });
}

client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) sendWelcomeMessage(member, channel);
});

// === MESSAGE HANDLER ===
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // !announce
  if (command === '!announce') {
    const announcement = args.join(' ');
    if (!announcement) {
      return message.reply('❗ Please include an announcement message.');
    }

    const announceEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📢 Big Pimpin’ Announcement')
      .setDescription(announcement)
      .setFooter({ text: `Announced by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [announceEmbed] });
  }

  // !help
  else if (command === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Command Menu')
      .setDescription('These are the commands you can use:')
      .addFields(
        { name: '`!announce [message]`', value: 'Drop a hot announcement.' },
        { name: '`!help`', value: 'Show this help menu.' },
        { name: '`!testwelcome`', value: 'Preview the welcome message (for testing).' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [helpEmbed] });
  }

  // !testwelcome
  else if (command === '!testwelcome') {
    const fakeMember = {
      user: message.author,
      guild: message.guild
    };
    sendWelcomeMessage(fakeMember, message.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);

