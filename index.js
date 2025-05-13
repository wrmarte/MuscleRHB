// index.js – Full Discord Bot with Announce, Welcome, Wallets, NFTs, PostgreSQL
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
  ssl: { rejectUnauthorized: false },
});
db.connect();
db.query(`
  CREATE TABLE IF NOT EXISTS wallet_links (
    user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL
  );
`);

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
const HOLDER_VERIFICATION_LINK = 'https://discord.com/channels/yourserver/verify';
const HOLDER_LEVELS = 'https://discord.com/channels/yourserver/levels';
const CONTRACT_ADDRESS = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';

function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function getWallet(userId) {
  const res = await db.query(`SELECT wallet_address FROM wallet_links WHERE user_id = $1`, [userId]);
  return res.rows[0]?.wallet_address || null;
}

async function linkWallet(userId, address) {
  await db.query(`
    INSERT INTO wallet_links (user_id, wallet_address)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
  `, [userId, address]);
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the streets', type: ActivityType.Watching }],
    status: 'online'
  });
});

// --- Welcome Message ---
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setTitle(`💎 Welcome, ${member.user.username}! 💎`)
    .setDescription(`**You made it to ${member.guild.name}, boss.** 😎  
🔑 [Verify Role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})  
Say hi. Make moves. Claim your throne. 💯`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId(`welcome_${member.id}`)
    .setLabel('👋 Welcome')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);
  channel.send({ embeds: [embed], components: [row] });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const [action, memberId] = interaction.customId.split('_');
  if (action !== 'welcome') return;

  const member = await interaction.guild.members.fetch(memberId).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

  await interaction.reply({
    content: `👑 ${interaction.user} welcomed ${member} to the crew!`,
    allowedMentions: { users: [interaction.user.id, memberId] }
  });
});

// --- Role Gained Message ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  if (!added.size) return;

  const channel = newMember.guild.systemChannel;
  if (!channel) return;

  added.forEach(role => {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🚨 New Status Unlocked!`)
      .setDescription(`✨ ${newMember.user} was crowned with **${role.name}**!`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Role: ${role.name}` })
      .setTimestamp();
    channel.send({ embeds: [embed] });
  });
});

// --- Message Commands ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // --- Announce ---
  if (command === '!announce') {
    const hasRole = message.member.roles.cache.some(r => r.name === ANNOUNCER_ROLE_NAME);
    if (!hasRole) return message.reply('🚫 Announcer role required.');

    const tagIndex = args.indexOf('--tag');
    let mention = '';
    if (tagIndex !== -1) {
      const tag = args[tagIndex + 1];
      const role = message.guild.roles.cache.find(r => r.name === tag);
      mention = role ? `<@&${role.id}>` : tag === 'everyone' ? '@everyone' : '';
      args.splice(tagIndex, 2);
    }

    const [rawTitle, ...rest] = args.join(' ').split('|');
    const embed = new EmbedBuilder()
      .setColor(0xFF5733)
      .setTitle(`📣 ${rawTitle}`)
      .setDescription(rest.join('|') || '*No additional details provided.*')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Posted by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ content: mention, embeds: [embed] });
  }

  // --- Link Wallet ---
  else if (command === '!linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return message.reply('❌ Invalid wallet address.');
    await linkWallet(message.author.id, address);
    message.reply(`✅ Wallet linked: \`${address}\``);
  }

  // --- My Wallet ---
  else if (command === '!mywallet') {
    const wallet = await getWallet(message.author.id);
    wallet
      ? message.reply(`🪙 Your wallet: \`${wallet}\``)
      : message.reply('⚠️ No wallet linked. Use `!linkwallet <0x...>`');
  }

  // --- Some Pimp ---
  else if (command === '!somepimp') {
    try {
      const res = await fetch(`https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`, {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });
      const data = await res.json();
      const nft = data.result[Math.floor(Math.random() * data.result.length)];
      const meta = JSON.parse(nft.metadata || '{}');
      let img = meta.image || '';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = (meta.attributes || [])
        .map(t => `• **${t.trait_type}**: ${t.value}${t.rarity_score ? ` (Rarity: ${t.rarity_score})` : ''}`).join('\n') || 'No traits.';

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`[${meta.name || 'CryptoPimp'} #${nft.token_id}](https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${nft.token_id})`)
        .setDescription(`Here's a random NFT from **CryptoPimps**.`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id} | Rank: ${meta.rank || 'Unknown'}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('NFT fetch error:', err);
      message.channel.send('🚫 Could not fetch NFT.');
    }
  }

  // --- My Pimp ---
  else if (command === '!mypimp') {
    const wallet = await getWallet(message.author.id);
    if (!wallet) return message.reply('⚠️ Use `!linkwallet <address>` first.');

    try {
      const res = await fetch(`https://deep-index.moralis.io/api/v2.2/${wallet}/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`, {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });
      const data = await res.json();
      const nft = data.result[Math.floor(Math.random() * data.result.length)];
      const meta = JSON.parse(nft.metadata || '{}');
      let img = meta.image || '';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = (meta.attributes || [])
        .map(t => `• **${t.trait_type}**: ${t.value}${t.rarity_score ? ` (Rarity: ${t.rarity_score})` : ''}`).join('\n') || 'No traits.';

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`[${meta.name || 'CryptoPimp'} #${nft.token_id}](https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${nft.token_id})`)
        .setDescription(`Here's one of your NFTs from **CryptoPimps**.`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id} | Rank: ${meta.rank || 'Unknown'}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('NFT fetch error:', err);
      message.channel.send('🚫 Could not fetch your NFT.');
    }
  }

  // --- Simulations ---
  else if (command === '!testwelcome') {
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${message.author.username}! 💎`)
      .setDescription(`Test welcome for **${message.guild.name}**.  
🔑 [Verify Role](${HOLDER_VERIFICATION_LINK})  
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

  else if (command === '!testrole') {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 Simulated Role Unlock')
      .setDescription(`✨ ${message.author} got the **Elite Pimp** role (test).`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Simulated role: Elite Pimp' })
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  else if (command === '!helpme') {
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!announce`', value: 'Send announcement. Requires announcer role.' },
        { name: '`!linkwallet`', value: 'Link your wallet to your Discord ID.' },
        { name: '`!mywallet`', value: 'Show your linked wallet.' },
        { name: '`!somepimp`', value: 'Random CryptoPimp from contract.' },
        { name: '`!mypimp`', value: 'Random CryptoPimp from your wallet.' },
        { name: '`!testwelcome`', value: 'Simulate welcome message.' },
        { name: '`!testrole`', value: 'Simulate role alert.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
