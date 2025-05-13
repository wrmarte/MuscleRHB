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
const { Client: PgClient } = require('pg');

// --- PostgreSQL Setup ---
const db = new PgClient({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
db.connect();
db.query(`
  CREATE TABLE IF NOT EXISTS wallet_links (
    user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL
  )
`);

// --- Utility Functions ---
function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function linkWallet(userId, address) {
  await db.query(`
    INSERT INTO wallet_links (user_id, wallet_address)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
  `, [userId, address]);
}

async function getWallet(userId) {
  const res = await db.query(`SELECT wallet_address FROM wallet_links WHERE user_id = $1`, [userId]);
  return res.rows[0]?.wallet_address || null;
}

// --- Bot Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ANNOUNCER_ROLE_NAME = 'ann';
const HOLDER_VERIFICATION_LINK = 'https://discord.com/channels/1316581666642464858/1322600796960981096';
const HOLDER_LEVELS = 'https://discord.com/channels/1316581666642464858/1347772808427606120';
const CONTRACT_ADDRESS = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';

// --- Ready ---
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the streets', type: ActivityType.Watching }],
    status: 'online'
  });
});

// --- Welcome ---
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setTitle(`💎 Welcome, ${member.user.username}! 💎`)
    .setDescription(`**You made it to ${member.guild.name}, boss.** 😎  
🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💯  
You’re crew member **#${member.guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId(`welcome_${member.id}`)
    .setLabel('👋 Welcome')
    .setStyle(ButtonStyle.Success);

  channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const [action, memberId] = interaction.customId.split('_');
  if (action !== 'welcome') return;

  const member = await interaction.guild.members.fetch(memberId).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

  interaction.reply({
    content: `👑 ${interaction.user} welcomed ${member} to the crew! 💯`,
    allowedMentions: { users: [interaction.user.id, memberId] }
  });
});

// --- Role Update ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (addedRoles.size === 0) return;

  const channel = newMember.guild.systemChannel;
  if (!channel) return;

  addedRoles.forEach(role => {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 New Status Unlocked!')
      .setDescription(`✨ ${newMember.user} leveled up with the **${role.name}** role! 👑`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Role granted: ${role.name}` })
      .setTimestamp();
    channel.send({ embeds: [embed] });
  });
});

// --- Commands ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // --- Announce ---
  if (command === '!announce') {
    await message.delete().catch(() => {});
    const hasRole = message.member.roles.cache.some(role => role.name === ANNOUNCER_ROLE_NAME);
    if (!hasRole) return message.channel.send('🚫 Announcer role required.');

    const tagIndex = args.indexOf('--tag');
    let mention = '';
    if (tagIndex !== -1 && args[tagIndex + 1]) {
      const tagArg = args[tagIndex + 1];
      if (tagArg === 'everyone') mention = '@everyone';
      else {
        const role = message.guild.roles.cache.find(r => r.name === tagArg);
        if (!role) return message.channel.send('❌ Role not found.');
        mention = `<@&${role.id}>`;
      }
      args.splice(tagIndex, 2);
    }

    const [title, ...desc] = args.join(' ').split('|');
    const embed = new EmbedBuilder()
      .setColor(0xFF5733)
      .setTitle(`📣 ${title.trim()}`)
      .setDescription(desc.join('|').trim() || '*No content provided.*')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Posted by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ content: mention, embeds: [embed] });
  }

  // --- Wallet Commands ---
  else if (command === '!linkwallet') {
    await message.delete().catch(() => {});
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return message.reply('❌ Invalid wallet address.');
    await linkWallet(message.author.id, address);
    message.reply(`✅ Wallet linked: \`${address}\``);
  }

  else if (command === '!mywallet') {
    await message.delete().catch(() => {});
    const wallet = await getWallet(message.author.id);
    message.reply(wallet ? `🪙 Your wallet: \`${wallet}\`` : '⚠️ No wallet linked.');
  }

  // --- NFT Commands ---
  else if (command === '!somepimp' || command === '!mypimp') {
    await message.delete().catch(() => {});
    const wallet = command === '!mypimp' ? await getWallet(message.author.id) : null;
    if (command === '!mypimp' && !wallet) return message.reply('⚠️ No wallet linked. Use `!linkwallet 0x...`');

    const url = command === '!mypimp'
      ? `https://deep-index.moralis.io/api/v2.2/${wallet}/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`
      : `https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`;

    try {
      const res = await fetch(url, {
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
        ? meta.attributes.map(t => `• **${t.trait_type}**: ${t.value}${t.rarity_score ? ` (Rarity: ${t.rarity_score})` : ''}`).join('\n')
        : '*No traits available.*';

      const rank = meta.rank ? ` | Rank: ${meta.rank}` : '';
      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`[${meta.name || 'CryptoPimp'} #${nft.token_id}](https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${nft.token_id})`)
        .setDescription(`🖼️ Click the title to view this NFT on OpenSea.\n${command === '!mypimp' ? 'From your wallet.' : 'Random from contract.'}`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id}${rank}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ NFT fetch error:', err);
      message.channel.send('🚫 Failed to fetch NFT.');
    }
  }

  // --- Simulated Welcome ---
  else if (command === '!testwelcome') {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${message.author.username}! 💎`)
      .setDescription(`**You made it to ${message.guild.name}, boss.** 😎  
🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${message.guild.memberCount}` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`welcome_${message.author.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
  }

  // --- Simulated Role ---
  else if (command === '!testrole') {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 Simulated Status Unlock')
      .setDescription(`✨ ${message.author} just got the **Elite Pimp** role.`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Simulated role: Elite Pimp' })
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  // --- Help ---
  else if (command === '!helpme') {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!announce`', value: 'Post an announcement (Announcer role required).' },
        { name: '`!somepimp`', value: 'Show a random CryptoPimp NFT.' },
        { name: '`!mypimp`', value: 'Show an NFT from your wallet.' },
        { name: '`!linkwallet 0x...`', value: 'Link your wallet address.' },
        { name: '`!mywallet`', value: 'View your wallet address.' },
        { name: '`!testwelcome`', value: 'Simulate a welcome message.' },
        { name: '`!testrole`', value: 'Simulate a role upgrade.' },
        { name: '`!helpme`', value: 'Display this help menu.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
