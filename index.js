require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Events,
  AttachmentBuilder
} = require('discord.js');
const fetch = require('node-fetch');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { Client: PgClient } = require('pg');
const { ethers } = require('ethers');
const { request, gql } = require('graphql-request');

const ethRpcs = [
  'https://rpc.ankr.com/eth',
  'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  'https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
  'https://cloudflare-eth.com'
];

// Resolve ENS via multiple RPCs
async function resolveENS(address) {
  for (const url of ethRpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      const name = await provider.lookupAddress(address);
      if (name) return name;
    } catch (err) {
      console.warn(`RPC failed (${url}): ${err.message}`);
    }
  }
  return null;
}

// Backup ENS fetch from The Graph
async function forceENSName(wallet) {
  const endpoint = 'https://api.thegraph.com/subgraphs/name/ensdomains/ens';
  const query = gql`
    query($owner: String!) {
      domains(first: 1, where: { owner: $owner }, orderBy: createdAt, orderDirection: desc) {
        name
      }
    }
  `;
  try {
    const data = await request(endpoint, query, { owner: wallet.toLowerCase() });
    return data.domains[0]?.name || null;
  } catch (err) {
    console.warn(`ENS graph query failed: ${err.message}`);
    return null;
  }
}

// PostgreSQL
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

const walletCache = new Map();
async function getWalletCached(userId) {
  if (walletCache.has(userId)) return walletCache.get(userId);
  const res = await db.query('SELECT wallet_address FROM wallet_links WHERE user_id = $1', [userId]);
  const wallet = res.rows[0]?.wallet_address || null;
  if (wallet) walletCache.set(userId, wallet);
  return wallet;
}
async function linkWallet(userId, address) {
  await db.query(`
    INSERT INTO wallet_links (user_id, wallet_address)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
  `, [userId, address]);
  walletCache.set(userId, address);
}

// Display formatter
async function getWalletDisplay(wallet) {
  let ens = await resolveENS(wallet);
  if (!ens) ens = await forceENSName(wallet);
  return ens
    ? `🔤 **ENS:** \`${ens}\``
    : `🔗 **Wallet:** \`${wallet.slice(0, 6)}...${wallet.slice(-4)}\``;
}

function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Discord client
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

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
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
    .setDescription(`**You made it to ${member.guild.name}, boss.** 😎  

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💫  
You’re crew member **#${member.guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId(`welcome_${member.id}`)
    .setLabel('👋 Welcome')
    .setStyle(ButtonStyle.Success);

  channel.send({ embeds: [welcomeEmbed], components: [new ActionRowBuilder().addComponents(button)] });
});
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (!addedRoles.size) return;

  const channel = newMember.guild.systemChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🔓 Role Unlocked!')
    .setDescription(`👑 <@${newMember.id}> just unlocked the **${[...addedRoles.values()].map(r => r.name).join(', ')}** role!`)
    .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()
    .setFooter({ text: `${newMember.user.username} leveled up` });

  channel.send({ embeds: [embed] });
});


client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const [action, memberId] = interaction.customId.split('_');
  if (action !== 'welcome') return;

  const member = await interaction.guild.members.fetch(memberId).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

  interaction.reply({
    content: `👑 ${interaction.user} welcomed ${member} to the crew! 💫`,
    allowedMentions: { users: [interaction.user.id, memberId] }
  });
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return message.reply('❌ Invalid wallet address.');
    await linkWallet(message.author.id, address);
    message.reply(`✅ Wallet linked: \`${address}\``);
  }

  else if (command === '!mywallet') {
    const userId = message.author.id;

    try {
      const result = await db.query('SELECT wallet_address FROM wallet_links WHERE user_id = $1', [userId]);

      if (result.rows.length === 0) {
        await message.reply({
          content: `<@${userId}> ❌ You haven't linked a wallet yet. Use \`!linkwallet YOUR_ADDRESS\` to connect one.`,
          allowedMentions: { users: [userId] }
        });
      } else {
        const wallet = result.rows[0].wallet_address;
        const displayLine = await getWalletDisplay(wallet);

        await message.reply({
          content: `<@${userId}>\n${displayLine}`,
          allowedMentions: { users: [userId] }
        });
      }

      setTimeout(() => message.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('!mywallet error:', err);
      await message.reply({
        content: `<@${userId}> ⚠️ There was an error fetching your wallet. Try again later.`,
        allowedMentions: { users: [userId] }
      });
    }
  }

  // ... PART 2 starts here with !mypimp, !somepimp, !mypimps, etc.
 else if (['!somepimp', '!mypimp'].includes(command)) {
  const isMyPimp = command === '!mypimp';
  const wallet = isMyPimp ? await getWalletCached(message.author.id) : null;
  if (isMyPimp && !wallet) return message.reply('⚠️ No wallet linked. Use `!linkwallet 0x...`');

  const url = isMyPimp
    ? `https://deep-index.moralis.io/api/v2.2/${wallet}/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal&limit=10`
    : `https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal&limit=10`;

  const loadingMsg = await message.channel.send('⏳ Fetching a fresh Pimp...');

  try {
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        'X-API-Key': process.env.MORALIS_API_KEY
      }
    });

    const data = await res.json();
    if (!data.result?.length) return loadingMsg.edit('❌ No NFTs found.');

    const nft = data.result[Math.floor(Math.random() * data.result.length)];
    const meta = JSON.parse(nft.metadata || '{}');

    // ✅ FIXED IMAGE LOGIC
    let img = 'https://via.placeholder.com/300x300';
    if (meta.image) {
      img = meta.image.startsWith('ipfs://')
        ? meta.image.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : meta.image;
    } else if (meta.image_url) {
      img = meta.image_url.startsWith('ipfs://')
        ? meta.image_url.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : meta.image_url;
    }

    const traits = Array.isArray(meta.attributes)
      ? meta.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
      : '*No traits available.*';

    const rank = meta.rank ? ` | Rank: ${meta.rank}` : '';
    const link = `https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${nft.token_id}`;
    const display = isMyPimp
      ? await getWalletDisplay(wallet)
      : `🧊 Random street Pimp`;

    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`${meta.name || 'CryptoPimp'} #${nft.token_id}`)
      .setDescription(`🖼️ [View on OpenSea](${link})\n${display}`)
      .setImage(img)
      .addFields({ name: '🧬 Traits', value: traits })
      .setFooter({ text: `Token ID: ${nft.token_id}${rank}` })
      .setTimestamp();

    await loadingMsg.edit({ content: '', embeds: [embed] });
  } catch (err) {
    console.error('❌ NFT fetch error:', err);
    loadingMsg.edit('🚫 Failed to fetch NFT.');
  }
}

  else if (command === '!somepimps' || command === '!mypimps') {
    const isMine = command === '!mypimps';
    const wallet = isMine ? await getWalletCached(message.author.id) : null;
    if (isMine && !wallet) return message.reply('⚠️ No wallet linked. Use `!linkwallet 0x...`');

    const loadingMsg = await message.channel.send('🎨 Building your CryptoPimps grid...');

    try {
      const url = isMine
        ? `https://deep-index.moralis.io/api/v2.2/${wallet}/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal&limit=50`
        : `https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal&limit=20`;

      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });

      const data = await res.json();
      if (!data.result?.length) return loadingMsg.edit('❌ No NFTs found.');

      const count = Math.random() < 0.5 ? 6 : 9;
      const sampled = data.result.sort(() => 0.5 - Math.random()).slice(0, count);
      const imageUrls = sampled.map(nft => {
        const meta = JSON.parse(nft.metadata || '{}');
        let img = meta.image || 'https://via.placeholder.com/150x150';
        return img.startsWith('ipfs://') ? img.replace('ipfs://', 'https://ipfs.io/ipfs/') : img;
      });

      const canvasSize = 150;
      const cols = 3;
      const rows = Math.ceil(imageUrls.length / cols);
      const canvas = createCanvas(canvasSize * cols, canvasSize * rows);
      const ctx = canvas.getContext('2d');

      const images = await Promise.all(imageUrls.map(url => loadImage(url)));
      images.forEach((img, i) => {
        const x = (i % cols) * canvasSize;
        const y = Math.floor(i / cols) * canvasSize;
        ctx.drawImage(img, x, y, canvasSize, canvasSize);
      });

      const buffer = canvas.toBuffer('image/png');
      const attachment = new AttachmentBuilder(buffer, { name: `${command}-grid.png` });

      const footerText = isMine
        ? (await resolveENS(wallet) || await forceENSName(wallet) || `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`)
        : `Random Grid`;

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(isMine ? `🧃 Your CryptoPimps Grid` : `🎰 Random CryptoPimps Collage`)
        .setImage(`attachment://${command}-grid.png`)
        .setFooter({ text: footerText })
        .setTimestamp();

      await loadingMsg.edit({ content: '', embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ NFT grid error:', err);
      loadingMsg.edit('🚫 Failed to fetch or render NFTs.');
    }
  }
  else if (command === '!announce' || command === '!announcew') {
  const fullText = args.join(' ');
  const imgMatch = fullText.match(/--img\s+(\S+)/);
  const tagMatch = fullText.match(/--tag\s+(\S+)/);

  const imageUrl = imgMatch ? imgMatch[1] : null;
  const tagRole = tagMatch ? tagMatch[1] : null;
  const cleanMsg = fullText
    .replace(/--img\s+\S+/, '')
    .replace(/--tag\s+\S+/, '')
    .trim();

  const isWide = command === '!announcew';

  // 🔎 Smart Title Inference
  const lowered = cleanMsg.toLowerCase();
  let title = '📢 Announcement';
  if (lowered.includes('win') || lowered.includes('winner')) title = '🏆 We Have a Winner!';
  else if (lowered.includes('alert') || lowered.includes('warning')) title = '🚨 Alert!';
  else if (lowered.includes('mint') || lowered.includes('drop')) title = '🔥 Mint or Drop Incoming!';
  else if (lowered.includes('update') || lowered.includes('news')) title = '🗞️ Fresh Update!';
  else if (lowered.includes('thank') || lowered.includes('grateful')) title = '🙏 Appreciation Post';
  else if (lowered.includes('launch') || lowered.includes('live')) title = '🚀 Launch Notice';

  const embed = new EmbedBuilder()
    .setColor(isWide ? 0xff1493 : getRandomColor())
    .setTitle(title)
    .setDescription(`**${cleanMsg}**`)
    .setFooter({ text: `Posted by ${message.author.username}` })
    .setTimestamp();

  if (imageUrl) embed.setImage(imageUrl);
  const contentText = tagRole ? `<@&${tagRole}>` : null;

  await message.channel.send({
    content: contentText,
    embeds: [embed],
    allowedMentions: { roles: tagRole ? [tagRole] : [] }
  });

  message.delete().catch(() => {});
}

  else if (command === '!testwelcome') {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${message.author.username}! 💎`)
      .setDescription(`**You made it to the server, boss.** 😎  

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💫`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`welcome_${message.author.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    await message.channel.send({
      embeds: [welcomeEmbed],
      components: [new ActionRowBuilder().addComponents(button)]
    });

    message.delete().catch(() => {});
  }

  else if (command === '!testrole') {
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle('🔓 Role Unlocked!')
      .setDescription(`Congrats, ${message.author}! You’ve unlocked an exclusive role. Keep hustling.`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    message.delete().catch(() => {});
  }

  // Other commands: help, test, announcements...
  else if (command === '!helpme') {
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!linkwallet <address>`', value: 'Link your wallet to your Discord account.' },
        { name: '`!mywallet`', value: 'Check your linked wallet (ENS or short address).' },
        { name: '`!mypimp`', value: 'Show a random NFT from your wallet.' },
        { name: '`!mypimps`', value: 'Display a collage of your NFTs.' },
        { name: '`!somepimp`', value: 'Show a random NFT from the collection.' },
        { name: '`!somepimps`', value: 'Display a collage of random collection NFTs.' },
        { name: '`!announce | msg --tag Role --img URL`', value: 'Send a styled announcement.' },
        { name: '`!announcew | msg --tag Role --img URL`', value: 'Send a wide-style welcome.' },
        { name: '`!testwelcome`', value: 'Simulate a welcome message.' },
        { name: '`!testrole`', value: 'Simulate a role unlock.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);


