// Updated bot with !somepimp command
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
const CONTRACT_ADDRESS = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';

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

// Welcome logic and role notifications omitted for brevity (same as your original)

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!somepimp') {
    try {
      const res = await fetch(`https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}?chain=base&format=decimal`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'X-API-Key': process.env.MORALIS_API_KEY
        }
      });
      const data = await res.json();
      if (!data.result || data.result.length === 0) {
        return message.channel.send('❌ No NFTs found in the contract.');
      }

      const randomNFT = data.result[Math.floor(Math.random() * data.result.length)];
      const metadata = JSON.parse(randomNFT.metadata || '{}');
      let imageUrl = metadata.image || 'https://via.placeholder.com/300x300?text=No+Image';
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${metadata.name || 'CryptoPimp'} #${randomNFT.token_id}`)
        .setDescription(`Here's a random NFT from the **CryptoPimps** contract.`)
        .setImage(imageUrl)
        .setFooter({ text: `Token ID: ${randomNFT.token_id}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error fetching NFT:', error);
      message.channel.send('🚫 Something went wrong while fetching a random pimp.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);


