require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField,
  Events
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Configurable
const ANNOUNCER_ROLE_NAME = 'ann';
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
  if (!channel) return;

  const welcomeEmbed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setTitle(`💎 Welcome, ${member.user.username}! 💎`)
    .setDescription(`
**You made it to ${member.guild.name}, boss.** 😎  
Keep it clean, flashy, and classy. 🍸

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💯  
You’re crew member **#${member.guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  const welcomeButton = new ButtonBuilder()
    .setCustomId(`welcome_${member.id}`)
    .setLabel('👋 Welcome')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(welcomeButton);

  channel.send({ embeds: [welcomeEmbed], components: [row] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, memberId] = interaction.customId.split('_');
  if (action !== 'welcome') return;

  const welcomedMember = await interaction.guild.members.fetch(memberId).catch(() => null);
  if (!welcomedMember) {
    return interaction.reply({ content: '❌ Could not find the member.', ephemeral: true });
  }

  await interaction.reply({
    content: `👑 ${interaction.user} welcomed ${welcomedMember} to the crew! 💯`,
    allowedMentions: { users: [interaction.user.id, memberId] }
  });
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!announce') {
    await message.delete().catch(() => {}); // Delete command message

    const hasRole = message.member.roles.cache.some(role => role.name === ANNOUNCER_ROLE_NAME);
    if (!hasRole) {
      return message.channel.send('🚫 You need the **Announcer** role to use this command.').then(m => {
        setTimeout(() => m.delete().catch(() => {}), 5000);
      });
    }

    const tagIndex = args.findIndex(arg => arg === '--tag');
    let mentionText = '';
    if (tagIndex !== -1) {
      const tagArg = args[tagIndex + 1];
      if (tagArg === 'everyone') {
        mentionText = '@everyone';
      } else {
        const role = message.guild.roles.cache.find(r => r.name === tagArg);
        if (role) {
          mentionText = `<@&${role.id}>`;
        } else {
          return message.channel.send('❌ Could not find the specified role to tag.').then(m => {
            setTimeout(() => m.delete().catch(() => {}), 5000);
          });
        }
      }
      args.splice(tagIndex, 2);
    }
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (addedRoles.size === 0) return; // No new roles added

  const channel = newMember.guild.systemChannel;
  if (!channel) return;

  addedRoles.forEach(role => {
    const roleEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎉 Role Added`)
      .setDescription(`${newMember.user} just got the **${role.name}** role!`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    channel.send({ embeds: [roleEmbed] });
  });
});

    const fullMsg = args.join(' ');
    if (!fullMsg) {
      return message.channel.send('❗ Please include an announcement message.').then(m => {
        setTimeout(() => m.delete().catch(() => {}), 5000);
      });
    }

    const [rawTitle, ...rest] = fullMsg.split('|');
    const title = rawTitle.trim();
    const content = rest.length > 0 ? rest.join('|').trim() : null;

    const announceEmbed = new EmbedBuilder()
      .setColor(0xFF5733)
      .setTitle(`📣 ${title}`)
      .setDescription(content || '*No additional details provided.*')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Posted by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    await message.channel.send({ content: mentionText, embeds: [announceEmbed] });
  }

  else if (command === '!helpme') {
    await message.delete().catch(() => {}); // Delete command message

    const helpEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .setDescription('Here are the available commands:')
      .addFields(
        {
          name: '`!announce [title] | [optional content] [--tag everyone|RoleName]`',
          value: 'Post a rich announcement (requires Announcer role).'
        },
        { name: '`!help`', value: 'Show this help menu.' },
        { name: '`!testwelcome`', value: 'Simulate the welcome message.' }
        { name: '`!testrole`', value: 'Simulate a role-added notification.' }

      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    await message.channel.send({ embeds: [helpEmbed] });
  }
else if (command === '!testrole') {
  await message.delete().catch(() => {}); // Delete command message

  const fakeRoleName = 'Elite Pimp';
  const testEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🎉 Role Added (Test)`)
    .setDescription(`${message.author} just got the **${fakeRoleName}** role!`)
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  message.channel.send({ embeds: [testEmbed] });
}

  else if (command === '!testwelcome') {
    await message.delete().catch(() => {}); // Delete command message

    const testMember = {
      user: message.author,
      guild: message.guild
    };

    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${testMember.user.username}! 💎`)
      .setDescription(`
**You made it to ${testMember.guild.name}, boss.** 😎  
Keep it clean, flashy, and classy. 🍸

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💯  
You’re crew member **#${testMember.guild.memberCount}**.`)
      .setThumbnail(testMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${testMember.guild.memberCount}` })
      .setTimestamp();

    const welcomeButton = new ButtonBuilder()
      .setCustomId(`welcome_${testMember.user.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(welcomeButton);

    message.channel.send({ embeds: [welcomeEmbed], components: [row] });
  }
});

client.login(process.env.DISCORD_TOKEN);


