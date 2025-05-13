// index.js — Smooth and Structured Discord Bot with NFT, Wallet, Welcome, and Utility Commands
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Events
} = require('discord.js');
const fetch = require('node-fetch');

// --- Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// --- Config ---
const ANNOUNCER_ROLE_NAME = 'ann';
const HOLDER_VERIFICATION_LINK = 'https://discord.com/channels/1316581666642464858/1322600796960981096';
const HOLDER_LEVELS = 'https://discord.com/channels/1316581666642464858/1347772808427606120';
const CONTRACT_ADDRESS = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';
const wallets = {}; // In-memory wallet store

function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

// --- Bot Ready ---
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the streets', type: ActivityType.Watching }],
    status: 'online'
  });
});

// --- Welcome New Members ---
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  const welcomeEmbed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setTitle(`💎 Welcome, ${member.user.username}! 💎`)
    .setDescription(`**You made it to ${member.guild.name}, boss.** 😎  
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

// --- Role Update Notification ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (!addedRoles.size) return;

  const channel = newMember.guild.systemChannel;
  if (!channel) return;

  addedRoles.forEach(role => {
    const roleEmbed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 New Status Unlocked!')
      .setDescription(`✨ ${newMember.user} leveled up in style with the **${role.name}** role! 👑\n\nShow some love, crew. This one’s climbing fast. 🏁`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Role granted: ${role.name}` })
      .setTimestamp();

    channel.send({ embeds: [roleEmbed] });
  });
});

// --- Command Handling ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // !announce
  if (command === '!announce') {
    const hasRole = message.member.roles.cache.some(role => role.name === ANNOUNCER_ROLE_NAME);
    if (!hasRole) return message.channel.send('🚫 You need the **Announcer** role to use this command.');

    const tagIndex = args.findIndex(arg => arg === '--tag');
    let mentionText = '';
    if (tagIndex !== -1) {
      const tagArg = args[tagIndex + 1];
      if (tagArg === 'everyone') mentionText = '@everyone';
      else {
        const role = message.guild.roles.cache.find(r => r.name === tagArg);
        if (!role) return message.channel.send('❌ Could not find the specified role to tag.');
        mentionText = `<@&${role.id}>`;
      }
      args.splice(tagIndex, 2);
    }

    const [rawTitle, ...rest] = args.join(' ').split('|');
    const title = rawTitle.trim();
    const content = rest.length > 0 ? rest.join('|').trim() : null;

    const embed = new EmbedBuilder()
      .setColor(0xFF5733)
      .setTitle(`📣 ${title}`)
      .setDescription(content || '*No additional details provided.*')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Posted by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    message.channel.send({ content: mentionText, embeds: [embed] });
  }

  // !somepimp - Random NFT from contract
  else if (command === '!somepimp') {
    try {
      const res = await fetch(`https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`, {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });
      const data = await res.json();
      if (!data.result?.length) return message.channel.send('❌ No NFTs found.');

      const nft = data.result[Math.floor(Math.random() * data.result.length)];
      const meta = JSON.parse(nft.metadata || '{}');
      let img = meta.image || 'https://via.placeholder.com/300x300';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = Array.isArray(meta.attributes)
        ? meta.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
        : '*No traits available.*';

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${meta.name || 'CryptoPimp'} #${nft.token_id}`)
        .setDescription(`Here's a random NFT from the **CryptoPimps** contract.\n[🖼️ View Image](${img})`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Error fetching contract NFT:', err);
      message.channel.send('🚫 Could not fetch a pimp from the contract.');
    }
  }

  // !mypimp - Random NFT owned by user
  else if (command === '!mypimp') {
    const wallet = wallets[message.author.id];
    if (!wallet) return message.channel.send('⚠️ You haven’t linked your wallet. Use `!linkwallet 0x...` first.');

    try {
      const res = await fetch(`https://deep-index.moralis.io/api/v2.2/${wallet}/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`, {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });
      const data = await res.json();
      if (!data.result?.length) return message.channel.send('❌ You don’t own any NFTs in this collection.');

      const nft = data.result[Math.floor(Math.random() * data.result.length)];
      const meta = JSON.parse(nft.metadata || '{}');
      let img = meta.image || 'https://via.placeholder.com/300x300';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = Array.isArray(meta.attributes)
        ? meta.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
        : '*No traits available.*';

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${meta.name || 'Your CryptoPimp'} #${nft.token_id}`)
        .setDescription(`Here's one of your NFTs from the **CryptoPimps** collection.\n[🖼️ View Image](${img})`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Error fetching user NFT:', err);
      message.channel.send('🚫 Could not fetch your pimp.');
    }
  }

  // !linkwallet
  else if (command === '!linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return message.channel.send('❌ Invalid wallet address.');
    wallets[message.author.id] = address;
    message.channel.send(`✅ Wallet linked: \`${address}\``);
  }

  // !mywallet
  else if (command === '!mywallet') {
    const wallet = wallets[message.author.id];
    if (wallet) message.channel.send(`🪙 Your wallet: \`${wallet}\``);
    else message.channel.send('⚠️ You haven’t linked a wallet yet. Use `!linkwallet 0x...`');
  }

  // !testwelcome
  else if (command === '!testwelcome') {
    const testMember = { user: message.author, guild: message.guild };
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${testMember.user.username}! 💎`)
      .setDescription(`**You made it to ${testMember.guild.name}, boss.** 😎  
Keep it clean, flashy, and classy. 🍸

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💯  
You’re crew member **#${testMember.guild.memberCount}**.`)
      .setThumbnail(testMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${testMember.guild.memberCount}` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`welcome_${testMember.user.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);
    message.channel.send({ embeds: [embed], components: [row] });
  }

  // !testrole
  else if (command === '!testrole') {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 Simulated Status Unlock')
      .setDescription(`✨ ${message.author} just got the **Elite Pimp** role in simulation mode.`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Simulated role: Elite Pimp' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }

  // !helpme
  else if (command === '!helpme') {
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!announce [title] | [optional content] [--tag everyone|RoleName]`', value: 'Post a rich announcement (requires Announcer role).' },
        { name: '`!somepimp`', value: 'Display a random CryptoPimp NFT with traits.' },
        { name: '`!mypimp`', value: 'Show a random CryptoPimp NFT you own.' },
        { name: '`!linkwallet 0x...`', value: 'Link your wallet address to your Discord ID.' },
        { name: '`!mywallet`', value: 'View your linked wallet address.' },
        { name: '`!testwelcome`', value: 'Simulate the welcome message.' },
        { name: '`!testrole`', value: 'Simulate a role-added notification.' },
        { name: '`!helpme`', value: 'Show this help menu.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
