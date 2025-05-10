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

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the server', type: ActivityType.Watching }],
    status: 'online'
  });
});

client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle(`👋 Welcome, ${member.user.username}!`)
      .setDescription(`We're thrilled to have you in **${member.guild.name}**! 🎉\nSay hi and enjoy your stay.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `You are member #${member.guild.memberCount}` })
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
  }

  else if (command === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
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

client.login(process.env.DISCORD_TOKEN);
