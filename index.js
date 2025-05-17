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
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

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

function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

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
    const wallet = await getWalletCached(message.author.id);
    message.reply(wallet ? `🪙 Your wallet: \`${wallet}\`` : '⚠️ No wallet linked.');
  }

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
      let img = meta.image || 'https://via.placeholder.com/300x300';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = Array.isArray(meta.attributes)
        ? meta.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
        : '*No traits available.*';

      const rank = meta.rank ? ` | Rank: ${meta.rank}` : '';
      const link = `https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${nft.token_id}`;

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${meta.name || 'CryptoPimp'} #${nft.token_id}`)
        .setDescription(`🖼️ [View this NFT on OpenSea](${link})\nHere’s a ${isMyPimp ? 'pimp from your wallet' : 'random pimp from the streets'}.`)
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

 // ... (rest of index.js remains unchanged)

  else if (command === '!somepimps') {
    const loadingMsg = await message.channel.send('🎨 Building your custom CryptoPimps grid...');

    try {
      const url = `https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal&limit=20`;
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
      const attachment = new AttachmentBuilder(buffer, { name: 'pimps-grid.png' });

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle('🎰 Random CryptoPimps Collage')
        .setImage('attachment://pimps-grid.png')
        .setFooter({ text: `Total displayed: ${imageUrls.length}` })
        .setTimestamp();

      await loadingMsg.edit({ content: '', embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ NFT grid error:', err);
      loadingMsg.edit('🚫 Failed to fetch or render NFTs.');
    }
  }
// ... (existing index.js content remains unchanged)

   else if (command === '!mypimps') {
    const wallet = await getWalletCached(message.author.id);
    if (!wallet) return message.reply('⚠️ No wallet linked. Use `!linkwallet 0x...`');

    const loadingMsg = await message.channel.send('🎨 Fetching your CryptoPimps...');

    try {
      const url = `https://deep-index.moralis.io/api/v2.2/${wallet}/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal&limit=50`;
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });

      const data = await res.json();
      if (!data.result?.length) return loadingMsg.edit('❌ No NFTs found in your wallet.');

      const count = data.result.length < 6 ? data.result.length : (Math.random() < 0.5 ? 6 : 9);
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
      const attachment = new AttachmentBuilder(buffer, { name: 'mypimps-grid.png' });

      const ensName = await provider.lookupAddress(wallet).catch(() => null);
      const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
      const footerText = ensName ? `${ensName} (${shortWallet})` : `Wallet: ${wallet}`;

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`🧃 ${message.author.username}'s CryptoPimps (${imageUrls.length})`)
        .setDescription(`Showing a random set from your wallet collection.`)
        .setImage('attachment://mypimps-grid.png')
        .setFooter({ text: footerText })
        .setTimestamp();

      await loadingMsg.edit({ content: '', embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ NFT fetch error (mypimps):', err);
      loadingMsg.edit('🚫 Failed to fetch or render your NFTs.');
    }
  }

  else if (command === '!announce' || command === '!announcew') {
    const hasRole = message.member.roles.cache.some(r => r.name === ANNOUNCER_ROLE_NAME);
    if (!hasRole) return message.channel.send('🚫 Announcer role required.');

    let mention = '';
    let imageUrl = '';
    const tagIndex = args.indexOf('--tag');
    if (tagIndex !== -1 && args[tagIndex + 1]) {
      const roleName = args[tagIndex + 1];
      const role = message.guild.roles.cache.find(r => r.name === roleName);
      if (!role && roleName !== 'everyone') return message.channel.send('❌ Role not found.');
      mention = roleName === 'everyone' ? '@everyone' : `<@&${role.id}>`;
      args.splice(tagIndex, 2);
    }

    const imgIndex = args.indexOf('--img');
    if (imgIndex !== -1 && args[imgIndex + 1]) {
      imageUrl = args[imgIndex + 1];
      args.splice(imgIndex, 2);
    }

    const [title, ...rest] = args.join(' ').split('|');
    const description = rest.join('|').trim() || '*No details provided.*';

    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(command === '!announcew' ? `📣 ${title.trim()}` : `📢 ${title.trim()}`)
      .setDescription(`**${description}**`)
      .setFooter({ text: `Posted by ${message.author.username}` })
      .setTimestamp();

    const sendMsg = async (embed, attachment = null) => {
      const payload = { content: mention ? `📣 ${mention}` : '', embeds: [embed] };
      if (attachment) payload.files = [attachment];
      return message.channel.send(payload);
    };

    if (imageUrl && /^https?:\/\/[^ ]+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(imageUrl)) {
      try {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const extMap = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/webp': '.webp'
        };
        const contentType = response.headers['content-type'] || '';
        const ext = extMap[contentType.split(';')[0]] || '.jpg';
        const fileName = `image${ext}`;
        const buffer = Buffer.from(response.data);
        const attachment = new AttachmentBuilder(buffer, { name: fileName });
        embed.setThumbnail(`attachment://${fileName}`);
        return sendMsg(embed, attachment);
      } catch (err) {
        console.error('❌ Image fetch error:', err.message);
        return message.channel.send('⚠️ Could not fetch or attach image.');
      }
    }

    return sendMsg(embed);
  }

  else if (command === '!testwelcome') {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${message.author.username}! 💎`)
      .setDescription(`**You made it to the test zone.** 😎

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Simulation` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`welcome_${message.author.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    message.channel.send({ embeds: [welcomeEmbed], components: [new ActionRowBuilder().addComponents(button)] });
  }

  else if (command === '!testrole') {
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🔓 Role Unlock Simulation')
      .setDescription(`You’ve reached a new level of pimpness, ${message.author}.\nYour holder role has been upgraded 💎`)
      .setFooter({ text: `Simulation` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }

  else if (command === '!helpme') {
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!linkwallet <address>`', value: 'Link your wallet to your Discord account.' },
        { name: '`!mywallet`', value: 'Check your linked wallet address.' },
        { name: '`!mypimp`', value: 'Show a random NFT you own from CryptoPimps.' },
        { name: '`!somepimp`', value: 'Show a random CryptoPimp from the entire collection.' },
        { name: '`!somepimps`', value: 'Display a grid of 4–6 random CryptoPimps.' },
        { name: '`!announce | msg --tag Role --img URL`', value: 'Send a styled announcement.' },
        { name: '`!announcew | msg --tag Role --img URL`', value: 'Send a wide-style announcement with image.' },
        { name: '`!testwelcome`', value: 'Simulate a welcome message.' },
        { name: '`!testrole`', value: 'Simulate a role unlock.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);

