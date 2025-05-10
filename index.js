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
    activities: [{ name: 'community updates', type: ActivityType.Watching }],
    status: 'online'
  });
});

// 🎉 Welcome New Members
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (channel) {
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#3498DB') // Calming blue tone
      .setAuthor({ name: 'New Member Joined', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
      .setTitle(`👋 Welcome to ${member.guild.name}, ${member.user.username}!`)
      .setDescription(`We're excited to have you here. Please check the rules and introduce yourself. 😊`)
      .addFields(
        { name: '🆔 Member ID', value: `${member.user.id}`, inline: true },
        { name: '📆 Joined At', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `You are member #${member.guild.memberCount}` })
      .setTimestamp();

    channel.send({ embeds: [welcomeEmbed] });
  }
});

// 📢 Announcement Command
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
      .setColor('#E67E22') // Rich orange
      .setTitle('📢 Official Server Announcement')
      .setDescription(`> ${announcement}`) // Blockquote style
      .setFooter({ text: `Posted by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    message.channel.send({ embeds: [announceEmbed] });
  }

  // 🆘 Help Command
  else if (command === '!musclehelp') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#2ECC71') // Soft green
      .setTitle('🛠 Command Menu')
      .setDescription('Here’s what I can do:')
      .addFields(
        { name: '`!announce [message]`', value: 'Post a highlighted announcement to the current channel.' },
        { name: '`!help`', value: 'Display this command list and usage info.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [helpEmbed] });
  }
});

client.login(process.env.DISCORD_TOKEN);

