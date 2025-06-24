// /commands/mute.js
const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Times out a user for a specified duration.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Duration of the mute (e.g., 10m, 1h, 1d).')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the mute.')
                .setRequired(false))
        // Set default permissions: only members with "Moderate Members" permission can see and use this command
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        // Ensure the command can only be used in guilds
        .setDMPermission(false),

    async execute(interaction) {
        // Defer reply to give us more time to process the command
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const time = interaction.options.getString('time');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        // --- Permission and Hierarchy Checks ---

        if (!targetMember) {
            return interaction.editReply("That user doesn't exist in this server.");
        }

        if (targetMember.id === interaction.guild.ownerId) {
             return interaction.editReply("You cannot mute the server owner.");
        }

        if (targetMember.id === interaction.user.id) {
            return interaction.editReply("You cannot mute yourself.");
        }
        
        if (targetMember.id === interaction.client.user.id) {
            return interaction.editReply("You cannot mute me.");
        }

        if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply("You cannot mute an administrator.");
        }
        
        // Check if the bot's highest role is lower than the target's highest role
        if (interaction.guild.members.me.roles.highest.position <= targetMember.roles.highest.position) {
            return interaction.editReply("I cannot mute this user because they have the same or a higher role than me.");
        }

        // Check if the command user's highest role is lower than the target's highest role
        if (interaction.member.roles.highest.position <= targetMember.roles.highest.position) {
             return interaction.editReply("You cannot mute this user because they have the same or a higher role than you.");
        }


        // --- Time Parsing ---

        const durationMs = ms(time);

        if (!durationMs) {
            return interaction.editReply("Invalid time format. Please use a valid format (e.g., '10m', '1h', '1d').");
        }

        // Discord's timeout limit is 28 days
        const maxTimeout = 28 * 24 * 60 * 60 * 1000;
        if (durationMs > maxTimeout) {
            return interaction.editReply(`The timeout duration cannot be longer than 28 days.`);
        }

        // --- Action and Confirmation ---

        try {
            await targetMember.timeout(durationMs, reason);
            
            // Send a success message to the moderator
            await interaction.editReply(`Successfully muted ${targetUser.tag}\nReason: ${reason}\nTime: ${time}.`);

            // Send a DM to the muted user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('You have been muted')
                    .setDescription(`You have been muted in **${interaction.guild.name}**.`)
                    .addFields(
                        { name: 'Duration', value: time, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                // If the user has DMs disabled, we can't send them a message.
                // We'll add a note to the moderator's confirmation.
                console.log(`Could not DM user ${targetUser.tag}.`);
                 await interaction.followUp({ content: `Could not send a DM to ${targetUser.tag}. They may have DMs disabled.`, ephemeral: true });
            }


        } catch (error) {
            console.error('Error muting member:', error);
            await interaction.editReply('An error occurred while trying to mute this member.');
        }
    },
};
