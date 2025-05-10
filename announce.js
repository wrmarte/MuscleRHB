const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement to this channel')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to announce')
        .setRequired(true)
    ),

  async execute(interaction) {
    const msg = interaction.options.getString('message');

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📢 Announcement')
      .setDescription(msg)
      .setFooter({ text: `Posted by ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
