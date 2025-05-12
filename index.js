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

const ANNOUNCER_ROLE_NAME = 'ann';
const HOLDER_VERIFICATION_LINK = 'https://discord.com/channels/1316581666642464858/1322600796960981096';
const HOLDER_LEVELS = 'https://discord.com/channels/1316581666642464858/1347772808427606120';

const WALLET_FILE = path.join(__dirname, 'wallets.json');

// --- PostgreSQL Wallet Storage ---
const db = new PgClient({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

db.connect();

db.query(`
  CREATE TABLE IF NOT EXISTS wallet_links (
    user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL
  )
`);

async function linkWallet(userId, walletAddress) {
  await db.query(
    `INSERT INTO wallet_links (user_id, wallet_address)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET wallet_address = EXCLUDED.wallet_address`,
    [userId, walletAddress]
  );
}

async function getWallet(userId) {
  const res = await db.query(
    `SELECT wallet_address FROM wallet_links WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0]?.wallet_address || null;
}

// --- File-based fallback wallet storage ---
function loadWallets() {
  try {
    return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveWallets(wallets) {
  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
}

function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

// --- Discord Client ---
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

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (addedRoles.size === 0) return;

  const channel = newMember.guild.systemChannel;
  if (!channel) return;

  addedRoles.forEach(role => {
    const roleEmbed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🚨 New Status Unlocked!`)
      .setDescription(`
✨ ${newMember.user} leveled up in style.  
They’ve just been crowned with the **${role.name}** role! 👑

Show some love, crew. This one’s climbing fast. 🏁`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Role granted: ${role.name}` })
      .setTimestamp();

    channel.send({ embeds: [roleEmbed] });
  });
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!announce') {
    await message.delete().catch(() => {});

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
    await message.delete().catch(() => {});
    const helpEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .setDescription('Here are the available commands:')
      .addFields(
        {
          name: '`!announce [title] | [optional content] [--tag everyone|RoleName]`',
          value: 'Post a rich announcement (requires Announcer role).'
        },
        { name: '`!helpme`', value: 'Show this help menu.' },
        { name: '`!testwelcome`', value: 'Simulate the welcome message.' },
        { name: '`!testrole`', value: 'Simulate a role-added notification.' },
        { name: '`!mypimp`', value: 'Display a random CryptoPimp NFT from your wallet.' },
        { name: '`!linkwallet 0x...`', value: 'Link your wallet to your Discord account.' },
        { name: '`!mywallet`', value: 'Show your linked wallet.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    await message.channel.send({ embeds: [helpEmbed] });
  }

  else if (command === '!linkwallet') {
    const walletAddress = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return message.reply('❌ Invalid wallet address.');
    }

    await linkWallet(message.author.id, walletAddress);
    message.reply(`✅ Linked your wallet: \`${walletAddress}\``);
  }

  else if (command === '!mywallet') {
    const wallet = await getWallet(message.author.id);
    if (wallet) {
      message.reply(`🪙 Your wallet: \`${wallet}\``);
    } else {
      message.reply('⚠️ You have not linked a wallet yet. Use `!linkwallet <address>`');
    }
  }

  else if (command === '!mypimp') {
    await message.delete().catch(() => {});
    const contractAddress = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';
    const userWallet = await getWallet(message.author.id);

    if (!userWallet) {
      return message.channel.send(`🚫 You haven't set a wallet. Use \`!linkwallet 0x...\` to link yours.`);
    }

    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': process.env.MORALIS_API_KEY
      }
    };

    try {
      const res = await fetch(`https://deep-index.moralis.io/api/v2.2/${userWallet}/nft/${contractAddress}?chain=base&format=decimal`, options);
      const data = await res.json();

      if (!data.result || data.result.length === 0) {
        return message.channel.send('❌ No NFTs found in the collection.');
      }

      const randomNFT = data.result[Math.floor(Math.random() * data.result.length)];
      const metadata = JSON.parse(randomNFT.metadata || '{}');

      let imageUrl = metadata.image || 'https://via.placeholder.com/300x300?text=No+Image';
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
// Simple test
const { Client } = require('pg');


const client = new Client();
client.connect().then(() => {
  console.log('Connected to DB');
  return client.end();
}).catch(err => console.error('DB connection error:', err));

      const nftEmbed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${metadata.name || 'CryptoPimp'} #${randomNFT.token_id}`)
        .setDescription(`Here's a random NFT from the streets of **CryptoPimps**.`)
        .setImage(imageUrl)
        .setFooter({ text: `Token ID: ${randomNFT.token_id}` })
        .setTimestamp();

      await message.channel.send({ embeds: [nftEmbed] });
    } catch (error) {
      console.error('Failed to fetch NFT:', error);
      message.channel.send('🚫 Something went wrong while fetching a pimp.');
    }
  }

  else if (command === '!testrole') {
    await message.delete().catch(() => {});
    const fakeRoleName = 'Elite Pimp';
    const testEmbed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🚨 Simulated Status Unlock`)
      .setDescription(`
🧪 This is a test alert.

✨ ${message.author} just got the **${fakeRoleName}** role in simulation mode.  
You can expect this style of alert when real roles are assigned! 🎭`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Simulated role: ${fakeRoleName}` })
      .setTimestamp();

    message.channel.send({ embeds: [testEmbed] });
  }

  else if (command === '!testwelcome') {
    await message.delete().catch(() => {});

    const welcomeEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`💎 Welcome, ${message.author.username}! 💎`)
      .setDescription(`
**You made it to ${message.guild.name}, boss.** 😎  
Keep it clean, flashy, and classy. 🍸

🔑 [Verify your role](${HOLDER_VERIFICATION_LINK})  
📊 [Pimp Levels](${HOLDER_LEVELS})

Say hi. Make moves. Claim your throne. 💯  
You’re crew member **#${message.guild.memberCount}**.`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${message.guild.memberCount}` })
      .setTimestamp();

    const welcomeButton = new ButtonBuilder()
      .setCustomId(`welcome_${message.author.id}`)
      .setLabel('👋 Welcome')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(welcomeButton);

    message.channel.send({ embeds: [welcomeEmbed], components: [row] });
  }
});

client.login(process.env.DISCORD_TOKEN);
