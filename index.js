require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType
} = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Config
const CONTRACT_ADDRESS = '0xc38e2ae060440c9269cceb8c0ea8019a66ce8927';
const wallets = {}; // In-memory wallet storage

// Utility
function getRandomColor() {
  const colors = [0xFFD700, 0xFF69B4, 0x8A2BE2, 0x00CED1, 0xDC143C];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Ready
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'the streets', type: ActivityType.Watching }],
    status: 'online'
  });
});

// Command Handler
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // !somepimp - Random NFT from contract
  if (command === '!somepimp') {
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
      const metadata = JSON.parse(nft.metadata || '{}');
      let img = metadata.image || 'https://via.placeholder.com/300x300';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = Array.isArray(metadata.attributes)
        ? metadata.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
        : '*No traits available.*';

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${metadata.name || 'CryptoPimp'} #${nft.token_id}`)
        .setDescription(`Here's a random NFT from the **CryptoPimps** contract.`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Error fetching contract NFTs:', err);
      message.channel.send('🚫 Could not fetch a pimp from the contract.');
    }
  }

  // !mypimp - Random NFT from user's wallet
  else if (command === '!mypimp') {
    const wallet = wallets[message.author.id];
    if (!wallet) {
      return message.channel.send('⚠️ You haven’t linked your wallet. Use `!linkwallet 0x...` first.');
    }

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
      const metadata = JSON.parse(nft.metadata || '{}');
      let img = metadata.image || 'https://via.placeholder.com/300x300';
      if (img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');

      const traits = Array.isArray(metadata.attributes)
        ? metadata.attributes.map(t => `• **${t.trait_type}**: ${t.value}`).join('\n')
        : '*No traits available.*';

      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`${metadata.name || 'Your CryptoPimp'} #${nft.token_id}`)
        .setDescription(`Here's one of your NFTs from the **CryptoPimps** collection.`)
        .setImage(img)
        .addFields({ name: '🧬 Traits', value: traits })
        .setFooter({ text: `Token ID: ${nft.token_id}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Error fetching owned NFTs:', err);
      message.channel.send('🚫 Could not fetch your pimp.');
    }
  }

  // !linkwallet 0x...
  else if (command === '!linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return message.channel.send('❌ Invalid wallet address.');
    }
    wallets[message.author.id] = address;
    message.channel.send(`✅ Wallet linked: \`${address}\``);
  }

  // !mywallet
  else if (command === '!mywallet') {
    const wallet = wallets[message.author.id];
    if (wallet) {
      message.channel.send(`🪙 Your wallet: \`${wallet}\``);
    } else {
      message.channel.send('⚠️ You haven’t linked a wallet yet. Use `!linkwallet 0x...`');
    }
  }

  // !helpme
  else if (command === '!helpme') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🛠 Bot Commands')
      .addFields(
        { name: '`!somepimp`', value: 'Show a random NFT from the CryptoPimps contract.' },
        { name: '`!mypimp`', value: 'Show a random NFT you own (requires linked wallet).' },
        { name: '`!linkwallet 0x...`', value: 'Link your wallet address to your Discord ID.' },
        { name: '`!mywallet`', value: 'View your linked wallet address.' },
        { name: '`!helpme`', value: 'Show this command list.' }
      )
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    message.channel.send({ embeds: [helpEmbed] });
  }
});

client.login(process.env.DISCORD_TOKEN);



