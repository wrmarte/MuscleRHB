// ========== [ Environment & Dependencies ] ==========
require('dotenv').config();
const {
  Client: DiscordClient,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField,
  Events
} = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { Client: PgClient } = require('pg');

// ========== [ Constants & Config ] ==========
const ANNOUNCER_ROLE_NAME = 'ann';
const HOLDER_VERIFICATION_LINK = 'https://discord.com/channels/1316581666642464858/1322600796960981096';
const HOLDER_LEVELS = 'https://discord.com/channels/1316581666642464858/1347772808427606120';
const WALLET_FILE = path.join(__dirname, 'wallets.json');
const CONTRACT_ADDRESS = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';

// ========== [ Utilities ] ==========
const getRandomColor = () => {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
};

// ========== [ PostgreSQL Wallet Storage ] ==========
const db = new PgClient({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
db.connect();
db.query(`
  CREATE TABLE IF NOT EXISTS wallet_links (
    user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL
)`);

const linkWallet = async (userId, walletAddress) => {
  await db.query(`
    INSERT INTO wallet_links (user_id, wallet_address)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
  `, [userId, walletAddress]);
};

const getWallet = async userId => {
  const res = await db.query('SELECT wallet_address FROM wallet_links WHERE user_id = $1', [userId]);
  return res.rows[0]?.wallet_address || null;
};

// ========== [ File-based Wallet Fallback ] ==========
const loadWallets = () => {
  try {
    return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  } catch {
    return {};
  }
};

const saveWallets = wallets => {
  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
};

// ========== [ Discord Bot Initialization ] ==========
const client = new DiscordClient({
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
    activities: [{ name: 'the streets', type: ActivityType.Watching }],
    status: 'online'
  });
});

// ========== [ Welcome Message Handler ] ==========
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
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

  const button = new ButtonBuilder()
    .setCustomId(`welcome_${member.id}`)
    .setLabel('👋 Welcome')
    .setStyle(ButtonStyle.Success);

  channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
});

// ========== [ Button Interactions ] ==========
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  const [action, memberId] = interaction.customId.split('_');
  if (action !== 'welcome') return;

  const member = await interaction.guild.members.fetch(memberId).catch(() => null);
  if (!member) {
    return interaction.reply({ content: '❌ Could not find the member.', ephemeral: true });
  }

  interaction.reply({
    content: `👑 ${interaction.user} welcomed ${member} to the crew! 💯`,
    allowedMentions: { users: [interaction.user.id, memberId] }
  });
});

// ========== [ Role Update Announcements ] ==========
client.on('guildMemberUpdate', (oldMember, newMember) => {
  const newRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  if (newRoles.size === 0 || !newMember.guild.systemChannel) return;

  newRoles.forEach(role => {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🚨 New Status Unlocked!')
      .setDescription(`
✨ ${newMember.user} leveled up in style with the **${role.name}** role! 👑

Show some love, crew. This one’s climbing fast. 🏁`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Role granted: ${role.name}` })
      .setTimestamp();

    newMember.guild.systemChannel.send({ embeds: [embed] });
  });
});

// ========== [ Message Commands ] ==========
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  switch (command) {
    case '!announce': { /* omitted for brevity */ break; }

    case '!linkwallet': { /* omitted for brevity */ break; }

    case '!mywallet': { /* omitted for brevity */ break; }

    case '!mypimp': { /* omitted for brevity */ break; }

    case '!somepimp': {
      await message.delete().catch(() => {});
      try {
        const res = await fetch(`https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'X-API-Key': process.env.MORALIS_API_KEY
          }
        });
        const data = await res.json();
        if (!data.result?.length) return message.channel.send('❌ No NFTs found in the contract.');

        const nft = data.result[Math.floor(Math.random() * data.result.length)];
        const meta = JSON.parse(nft.metadata || '{}');
        let img = meta.image || 'https://via.placeholder.com/300x300?text=No+Image';
        if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

        const embed = new EmbedBuilder()
          .setColor(getRandomColor())
          .setTitle(`${meta.name || 'CryptoPimp'} #${nft.token_id}`)
          .setDescription(`Here's a random NFT pulled directly from the **CryptoPimps** contract.`)
          .setImage(img)
          .setFooter({ text: `Token ID: ${nft.token_id}` })
          .setTimestamp();

        message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error('Error fetching NFT:', err);
        message.channel.send('🚫 Something went wrong fetching the contract NFT.');
      }
      break;
    }

    case '!helpme': {
      await message.delete().catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(0x00FF7F)
        .setTitle('🛠 Bot Commands')
        .addFields(
          { name: '`!announce [title] | [content] [--tag everyone|Role]`', value: 'Make an announcement (Announcer role only).' },
          { name: '`!linkwallet 0x...`', value: 'Link your wallet to your Discord account.' },
          { name: '`!mywallet`', value: 'Show your linked wallet address.' },
          { name: '`!mypimp`', value: 'Show a random NFT from your wallet in the CryptoPimps collection.' },
          { name: '`!somepimp`', value: 'Show a completely random NFT from the CryptoPimps contract.' },
          { name: '`!testwelcome` / `!testrole`', value: 'Simulate welcome or role alert messages.' },
          { name: '`!helpme`', value: 'Show this command menu.' }
        )
        .setFooter({ text: `Requested by ${message.author.username}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
      break;
    }

    case '!testwelcome': { client.emit('guildMemberAdd', message.member); break; }
    case '!testrole': { /* omitted for brevity */ break; }
  }
});

// ========== [ Bot Login ] ==========
client.login(process.env.DISCORD_TOKEN);


