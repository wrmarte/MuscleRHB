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
const path = require('path');
const { Client: PgClient } = require('pg');

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
Keep it clean, flashy, and classy. 🍸

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
  const autoDelete = () => message.delete().catch(() => {});

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const path = require('path');

if (command === '!announce') {
  autoDelete();

  const hasRole = message.member.roles.cache.some(r => r.name === ANNOUNCER_ROLE_NAME);
  if (!hasRole) return message.channel.send('🚫 Announcer role required.');

  let mention = '';
  let imageUrl = '';

  // --tag parsing
  const tagIndex = args.indexOf('--tag');
  if (tagIndex !== -1 && args[tagIndex + 1]) {
    const roleName = args[tagIndex + 1];
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role && roleName !== 'everyone') return message.channel.send('❌ Role not found.');
    mention = roleName === 'everyone' ? '@everyone' : `<@&${role.id}>`;
    args.splice(tagIndex, 2);
  }

  // --img parsing
  const imgIndex = args.indexOf('--img');
  if (imgIndex !== -1 && args[imgIndex + 1]) {
    imageUrl = args[imgIndex + 1];
    args.splice(imgIndex, 2);
  }

  const [title, ...rest] = args.join(' ').split('|');
  const description = rest.join('|').trim() || '*No details provided.*';

  const embed = new EmbedBuilder()
    .setColor(0xFF5733)
    .setTitle(`📣 ${title.trim()}`)
    .setDescription(`**${description}**`)
    .setFooter({ text: `Posted by ${message.author.username}` })
    .setTimestamp();

  if (imageUrl && /^https?:\/\/[^ ]+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(imageUrl)) {
    try {
      const cleanUrl = imageUrl.split('?')[0];
      const ext = path.extname(cleanUrl) || '.jpg';
      const fileName = `announcement${ext}`;
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);
      const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });

      embed.setImage(`attachment://${fileName}`);

      return await message.channel.send({
        content: mention ? `📣 **${mention}**` : '',
        embeds: [embed],
        files: [attachment]
      });
    } catch (err) {
      console.error('❌ Image fetch error:', err.message);
      await message.channel.send('⚠️ Could not upload image, posting without it.');
    }
  }

  // Fallback if no image or error
  await message.channel.send({
    content: mention ? `📣 **${mention}**` : '',
    embeds: [embed]
  });
}




  else if (command === '!announcew') {
    autoDelete();
    const imageUrl = 'https://i.imgur.com/OzZUnfT.jpg';

    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const fileName = 'image.jpg';
      const imageBuffer = Buffer.from(response.data);
      const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });

      const embed = new EmbedBuilder()
        .setTitle('📢 Test Announcement')
        .setDescription('Image should show below')
        .setImage(`attachment://${fileName}`)
        .setTimestamp();

      return message.channel.send({
        content: `📣 **@everyone**`,
        embeds: [embed],
        files: [attachment]
      });
    } catch (err) {
      console.error('Failed to fetch image:', err.message);
      return message.channel.send('⚠️ Could not fetch the image.');
    }
  }

  else if (command === '!linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return message.reply('❌ Invalid wallet address.');
    await linkWallet(message.author.id, address);
    message.reply(`✅ Wallet linked: \`${address}\``);
  }

  else if (command === '!mywallet') {
    const wallet = await getWallet(message.author.id);
    message.reply(wallet ? `🪙 Your wallet: \`${wallet}\`` : '⚠️ No wallet linked.');
  }

  else if (['!somepimp', '!mypimp'].includes(command)) {
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
        ? meta.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
        : '*No traits available.*';

      const rank = meta.rank ? ` | Rank: ${meta.rank}` : '';
      const link = `https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${nft.token_id}`;

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${meta.name || 'CryptoPimp'} #${nft.token_id}`)
        .setDescription(`🖼️ [View this NFT on OpenSea](${link})\nHere's a ${command === '!mypimp' ? 'pimp from your wallet' : 'random pimp from the streets'}.`)
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

  else if (command === '!testwelcome') {
    autoDelete();
    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${message.member.user.username}! 💎`)
      .setDescription(`
**You made it to ${message.guild.name}, boss.** 😎  
Keep it clean, flashy, and classy. 🍸

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💯  
You’re crew member **#${message.guild.memberCount}**.`)
      .setThumbnail(message.member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${message.guild.memberCount}` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`welcome_${message.author.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    message.channel.send({ embeds: [welcomeEmbed], components: [new ActionRowBuilder().addComponents(button)] });
  }

  else if (command === '!testrole') {
    autoDelete();
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 Simulated Status Unlock')
      .setDescription(`✨ ${message.author} just got the **Elite Pimp** role.`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Simulated role: Elite Pimp' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }

  else if (command === '!helpme') {
    autoDelete();
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!announce`', value: 'Send a formatted announcement (with optional tag).' },
        { name: '`!announcew`', value: 'Send a test image announcement.' },
        { name: '`!somepimp`', value: 'Show a random CryptoPimp NFT.' },
        { name: '`!mypimp`', value: 'Show a random NFT you own from CryptoPimps.' },
        { name: '`!linkwallet <address>`', value: 'Link your wallet to your Discord account.' },
        { name: '`!mywallet`', value: 'Check your linked wallet address.' },
        { name: '`!testwelcome`', value: 'Simulate a welcome message.' },
        { name: '`!testrole`', value: 'Simulate a role unlock notification.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
