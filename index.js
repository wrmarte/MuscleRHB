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

const HOLDER_VERIFICATION_LINK = 'https://discord.com/channels/1316581666642464858/1322600796960981096';
const HOLDER_LEVELS = 'https://discord.com/channels/1316581666642464858/1347772808427606120';

function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the streets', type: ActivityType.Watching }],
    status: 'online'
  });
});

client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 **Welcome to the Family, ${member.user.username}!** 💎`)
      .setDescription(`
**Yo, ${member.user.username}, you've just rolled up to the hottest spot in town!** 😎  
We're hyped to have you here in **${member.guild.name}**. This joint’s where style meets hustle, and you're right on time. 🍸

🔑 **First move? Slide over to [Holder Verification](${HOLDER_VERIFICATION_LINK}) to verify and claim your roles.** No pass, no status — you know how it goes. 💼  

**Here's your VIP guide:**
• See all Pimp levels [PIMP LEVELS](${HOLDER_LEVELS}) :feather:
• Introduce yourself – Step in, let us know who just arrived. 💬  
• Get involved – We’re always making moves. Stay sharp. 🔥

You’re now part of the crew — **#${member.guild.memberCount}** strong. Time to flex, vibe, and leave your mark. 💯

Welcome to the club, boss. 😏`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount} – Leveling up daily.` })
      .setTimestamp();

    channel.send({ embeds: [welcomeEmbed] });
  }
});

client.on('messageCreate', message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!announce') {
    const announcement = args.join(' ');
    if (!announcement) {
      return message.reply('❗ Please include an announcement message.');
    }

    const announceEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📢 Announcement')
      .setDescription(announcement)
      .setFooter({ text: `Posted by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [announceEmbed] });
  } else if (command === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .setDescription('Here are the available commands:')
      .addFields(
        { name: '`!announce [message]`', value: 'Make a stylish announcement.' },
        { name: '`!help`', value: 'Show this help menu.' },
        { name: '`!testwelcome`', value: 'Simulate the pimp-style welcome message.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [helpEmbed] });
  } else if (command === '!testwelcome') {
    const testMember = {
      user: message.author,
      guild: message.guild
    };

    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 **Welcome to the Family, ${testMember.user.username}!** 💎`)
      .setDescription(`
**Yo, ${testMember.user.username}, you've just rolled up to the hottest spot in town!** 😎  
We're hyped to have you here in **${testMember.guild.name}**. This joint’s where style meets hustle, and you're right on time. 🍸

🔑 **First move? Slide over to [Holder Verification](${HOLDER_VERIFICATION_LINK}) to verify and claim your roles.** No pass, no status — you know how it goes. 💼  

**Here's your VIP guide:**
• Check the rules – Know the game before you play. 📜  
• Introduce yourself – Step in, let us know who just arrived. 💬  
• Get involved – We’re always making moves. Stay sharp. 🔥

You’re now part of the crew — **#${testMember.guild.memberCount}** strong. Time to flex, vibe, and leave your mark. 💯

Welcome to the club, boss. 😏`)
      .setThumbnail(testMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${testMember.guild.memberCount} – Leveling up daily.` })
      .setTimestamp();

    message.channel.send({ embeds: [welcomeEmbed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
