require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Color themes array
const colorThemes = [
  0x00BFFF,  // SkyBlue
  0xFFA500,  // Orange
  0x8A2BE2,  // BlueViolet
  0x00FF7F,  // SpringGreen
  0xFF69B4,  // HotPink
  0xFFD700,  // Gold
  0x228B22,  // ForestGreen
  0x9932CC,  // DarkOrchid
  0xFF4500,  // OrangeRed
  0x800080   // Purple
];

// Function to get a random color from the colorThemes array
function getRandomColor() {
  return colorThemes[Math.floor(Math.random() * colorThemes.length)];
}

// When the bot is ready
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the server', type: ActivityType.Watching }],
    status: 'online'
  });
});

// New member joining
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())  // Use random color from themes
      .setTitle(`👋 Welcome, ${member.user.username}!`)
      .setDescription(`We're thrilled to have you in **${member.guild.name}**! 🎉\nSay hi and enjoy your stay.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `You are member #${member.guild.memberCount}` })
      .setTimestamp();

    channel.send({ embeds: [welcomeEmbed] });
  }
});

// Message handling (for commands)
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // Announcement Command
  if (command === '!announce') {
    const announcement = args.join(' ');
    if (!announcement) {
      return message.reply('❗ Please include an announcement message.');
    }

    const announceEmbed = new EmbedBuilder()
      .setColor(getRandomColor())  // Use random color from themes
      .setTitle('📢 Announcement')
      .setDescription(announcement)
      .setFooter({ text: `Posted by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [announceEmbed] });
  }

  // Help Command
  else if (command === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(getRandomColor())  // Use random color from themes
      .setTitle('🛠 Bot Commands')
      .setDescription('Here are the available commands:')
      .addFields(
        { name: '`!announce [message]`', value: 'Make a stylish announcement.' },
        { name: '`!help`', value: 'Show this help menu.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [helpEmbed] });
  }
});
else if (command === '!testwelcome') {
  const testMember = {
    user: message.author,
    guild: message.guild,
  };

  const welcomeEmbed = new EmbedBuilder()
    .setColor(getRandomColor()) // Use the same random color function
    .setTitle(`💎 **Welcome to the Family, ${testMember.user.username}!** 💎`)
    .setDescription(`
      **Yo, ${testMember.user.username}, you've just rolled up to the hottest spot in town!** 😎  
      We're hyped to have you here in **${testMember.guild.name}**. This joint’s where style meets hustle, and you're right on time. 🍸

      🔑 **First move? Slide over to <#holder-verification> to verify and claim your roles.** No pass, no status — you know how it goes. 💼  

      **Here's your VIP guide:**
      • Check the rules – Know the game before you play. 📜  
      • Introduce yourself – Step in, let us know who just arrived. 💬  
      • Get involved – We’re always making moves. Stay sharp. 🔥

      You’re now part of the crew — **#${testMember.guild.memberCount}** strong. Time to flex, vibe, and leave your mark. 💯

      Welcome to the club, boss. 😏
    `)
    .setThumbnail(testMember.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member #${testMember.guild.memberCount} – Leveling up daily.` })
    .setTimestamp();

  message.channel.send({ embeds: [welcomeEmbed] });
}


client.login(process.env.DISCORD_TOKEN);
