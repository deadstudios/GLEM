// src/commands/archive.js
const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    DiscordAPIError
} = require('discord.js');
// All database functions are assumed to be correctly imported
const { getArchiveData, getArchiveStats, getAllArchives, deleteArchiveData, saveArchiveData, updateArchiveStatus } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('archive')
        .setDescription('Manage user-based code archives')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new archive for a user based on their display name')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to create the archive for (defaults to you)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription("Delete a user's archive and all its channels")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose archive you want to delete')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription("Disable posting permissions for a user's archive")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose archive you want to disable')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription("Enable posting permissions for a user's archive")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose archive you want to enable')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription("Get information about a user's archive")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to get archive info for (defaults to you)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('scan')
                .setDescription('Scan and sync server archives with the database')
                .addBooleanOption(option =>
                    option.setName('sync-database')
                        .setDescription('Sync found/missing archives with the database (default: false)')
                        .setRequired(false))),
    
    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create':
                await this.handleCreate(interaction);
                break;
            case 'delete':
                await this.handleDelete(interaction);
                break;
            case 'disable':
                await this.handleDisable(interaction);
                break;
            case 'enable':
                await this.handleEnable(interaction);
                break;
            case 'info':
                await this.handleInfo(interaction);
                break;
            case 'scan':
                await this.handleScan(interaction);
                break;
        }
    },
    
    async handleCreate(interaction) {
        const author = interaction.options.getUser('user') || interaction.user;
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            const member = await guild.members.fetch(author.id);
            if (!member) {
                 return await interaction.editReply({ content: 'Could not find that member in this server.' });
            }
            const archiveName = member.displayName;

            const existingArchive = await getArchiveData(null, archiveName);
            if (existingArchive) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900').setTitle('⚠️ Archive Already Exists')
                    .setDescription(`An archive for **${member.user.tag}** (named "${archiveName}") already exists. A user can only have one archive based on their display name.`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const categoryName = `${archiveName}'s Archive`;
            const category = await guild.channels.create({
                name: categoryName, type: ChannelType.GuildCategory,
                permissionOverwrites: [{ id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }]
            });

            const forumChannel = await guild.channels.create({
                name: 'forum', type: ChannelType.GuildText, parent: category.id,
                topic: `General discussion and questions for ${archiveName}'s Archive`,
            });
            
            const channelGroups = [
                { name: 'block-examples', description: 'Block-related code examples' }, { name: 'block-projects', description: 'Block-related projects' },
                { name: 'command-example', description: 'Command code examples' }, { name: 'command-projects', description: 'Command projects' },
                { name: 'entity-examples', description: 'Entity-related code examples' }, { name: 'entity-projects', description: 'Entity-related projects' },
                { name: 'item-examples', description: 'Item-related code examples' }, { name: 'item-projects', description: 'Item-related projects' },
                { name: 'misc-examples', description: 'Miscellaneous code examples' }, { name: 'misc-projects', description: 'Miscellaneous projects' },
                { name: 'particles-examples', description: 'Particle-related code examples' }, { name: 'particles-projects', description: 'Particle-related projects' },
                { name: 'javascript-examples', description: 'JavaScript code examples' }, { name: 'javascript-functional', description: 'Functional JavaScript code' }, { name: 'javascript-projects', description: 'JavaScript projects' },
                { name: 'sound_effects', description: 'Sound effect examples' }, { name: 'music-assets', description: 'Music and audio assets' }
            ];
            
            const createdChannels = [];
            for (const channelType of channelGroups) {
                const channel = await guild.channels.create({
                    name: channelType.name, type: ChannelType.GuildForum, parent: category.id, topic: channelType.description,
                    permissionOverwrites: [
                        { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
                        { id: author.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.ManageMessages] }
                    ]
                });
                createdChannels.push(channel);
            }

            const workingNotesChannel = await guild.channels.create({
                name: 'working-notes', type: ChannelType.GuildForum, parent: category.id, topic: `Private working notes for ${archiveName}'s Archive`,
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageThreads] }
                ]
            });

            const archiveData = {
                name: archiveName, authorId: author.id, categoryId: category.id, forumChannelId: forumChannel.id, workingNotesChannelId: workingNotesChannel.id,
                channels: createdChannels.map(ch => ({ id: ch.id, name: ch.name })), createdAt: new Date(), enabled: true
            };
            await saveArchiveData(archiveData);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00').setTitle('✅ Archive Created Successfully!')
                .setDescription(`**${categoryName}** has been created.`)
                .addFields([
                    { name: '👤 Author', value: `${author.tag}`, inline: true },
                    { name: '📁 Category', value: `<#${category.id}>`, inline: true },
                    { name: '💬 Forum', value: `<#${forumChannel.id}>`, inline: true },
                    { name: '📊 Channels Created', value: `${createdChannels.length + 2}`, inline: true }
                ]).setTimestamp();
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating archive:', error);
            if (error instanceof DiscordAPIError && error.code === 50013) { // Missing Permissions
                const embed = new EmbedBuilder()
                    .setColor('#FF0000').setTitle('❌ Permission Error')
                    .setDescription('I do not have the necessary permissions to create channels or categories. Please ensure I have the `Manage Channels` permission.');
                return await interaction.editReply({ embeds: [embed] });
            }
            await interaction.editReply({ content: '❌ An unexpected error occurred while creating the archive. Please check the console.' });
        }
    },

    async handleDelete(interaction) {
        const user = interaction.options.getUser('user');
        const guild = interaction.guild;
    
        await interaction.deferReply({ ephemeral: true });
    
        const member = await guild.members.fetch(user.id);
        if (!member) {
             return await interaction.editReply({ content: 'Could not find that member in this server.' });
        }
        const archiveName = member.displayName;
    
        const archive = await getArchiveData(null, archiveName);
        if (!archive || archive.authorId !== user.id) {
            const embed = new EmbedBuilder()
                .setColor('#FF9900').setTitle('❌ Archive Not Found')
                .setDescription(`No archive found for user **${user.tag}** (expected archive name: "${archiveName}").`);
            return await interaction.editReply({ embeds: [embed] });
        }
    
        const confirmId = `confirm_delete_${archive.name}_${interaction.user.id}`;
        const cancelId = `cancel_delete_${interaction.user.id}`;
    
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(confirmId).setLabel('Yes, Delete It').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
    
        const embed = new EmbedBuilder()
            .setColor('#FF0000').setTitle('⚠️ Are you absolutely sure?')
            .setDescription(`This will permanently delete the **${archive.name}'s Archive** category and all its channels for user <@${archive.authorId}>. **This action cannot be undone.**`)
    
        const reply = await interaction.editReply({ embeds: [embed], components: [row] });
    
        try {
            const collectorFilter = i => i.user.id === interaction.user.id;
            const confirmation = await reply.awaitMessageComponent({ filter: collectorFilter, componentType: ComponentType.Button, time: 60_000 });
    
            if (confirmation.customId === confirmId) {
                await confirmation.update({ content: 'Deleting archive...', embeds: [], components: [] });
    
                const category = guild.channels.cache.get(archive.categoryId);
                if (category) {
                    const channelsInCategory = guild.channels.cache.filter(ch => ch.parentId === category.id);
                    for (const [, channel] of channelsInCategory) {
                        try {
                            await channel.delete('Archive deletion requested by user.');
                        } catch (err) {
                            console.error(`Deletion error for #${channel.name}:`, err);
                        }
                    }
                    await category.delete('Archive deletion requested by user.');
                }
    
                await deleteArchiveData(archiveName);
    
                const resultEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Archive Deleted')
                    .setDescription(`Archive "${archiveName}" has been removed.`);
                await confirmation.editReply({ embeds: [resultEmbed] });
    
            } else if (confirmation.customId === cancelId) {
                await confirmation.update({ content: 'Deletion cancelled.', embeds: [], components: [] });
            }
        } catch (e) {
            await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling.', components: [] });
        }
    },

    async _getArchiveByMember(member) {
        if (!member) return null;
        const archiveName = member.displayName;
        const archive = await getArchiveData(null, archiveName);
        if (archive && archive.authorId === member.id) {
            return archive;
        }
        return null;
    },

    async handleDisable(interaction) {
        const user = interaction.options.getUser('user');
        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });

        try {
            const member = await guild.members.fetch(user.id);
            const archive = await this._getArchiveByMember(member);
            
            if (!archive) {
                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF9900').setTitle('❌ Archive Not Found').setDescription(`No archive found for user **${user.tag}**.`)] });
            }

            for (const channelData of archive.channels) {
                const channel = guild.channels.cache.get(channelData.id);
                if (channel && channel.type === ChannelType.GuildForum) {
                    await channel.permissionOverwrites.edit(archive.authorId, { SendMessages: false, CreatePublicThreads: false });
                }
            }

            await updateArchiveStatus(archive.name, false);
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('🔒 Archive Disabled').setDescription(`Posting permissions for **${user.tag}**'s archive ("${archive.name}") have been disabled.`)] });
        } catch (error) {
            console.error('Error disabling archive:', error);
            await interaction.editReply({ content: '❌ An error occurred while disabling the archive.' });
        }
    },

    async handleEnable(interaction) {
        const user = interaction.options.getUser('user');
        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });

        try {
            const member = await guild.members.fetch(user.id);
            const archive = await this._getArchiveByMember(member);

            if (!archive) {
                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF9900').setTitle('❌ Archive Not Found').setDescription(`No archive found for user **${user.tag}**.`)] });
            }

            for (const channelData of archive.channels) {
                const channel = guild.channels.cache.get(channelData.id);
                if (channel && channel.type === ChannelType.GuildForum) {
                    await channel.permissionOverwrites.edit(archive.authorId, { SendMessages: true, CreatePublicThreads: true });
                }
            }

            await updateArchiveStatus(archive.name, true);
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('🔓 Archive Enabled').setDescription(`Posting permissions for **${user.tag}**'s archive ("${archive.name}") have been enabled.`)] });
        } catch (error) {
            console.error('Error enabling archive:', error);
            await interaction.editReply({ content: '❌ An error occurred while enabling the archive.' });
        }
    },

    async handleInfo(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        await interaction.deferReply();

        try {
            const archives = await getArchiveData(targetUser.id);
            
            if (archives.length === 0) {
                 return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF9900').setTitle('📁 No Archive Found').setDescription(`**${targetUser.tag}** does not have an archive.`)] });
            }
            
            const archive = archives.find(a => a.name === targetUser.displayName) || archives[0];
            const stats = await getArchiveStats(targetUser.id);

            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle(`📁 ${archive.name}'s Archive`)
                .setTimestamp()
                .addFields(
                    { name: '👤 Author', value: `<@${archive.authorId}>`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(new Date(archive.createdAt).getTime() / 1000)}:R>`, inline: true },
                    { name: '🔐 Status', value: archive.enabled !== false ? '🔓 Enabled' : '🔒 Disabled', inline: true },
                    { name: '📊 Total Examples', value: stats.totalExamples.toString(), inline: false },
                    { name: '🔗 Quick Links', value: `**Forum:** <#${archive.forumChannelId}>\n**Notes:** <#${archive.workingNotesChannelId}>`, inline: false }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching archive info:', error);
            await interaction.editReply({ content: '❌ An error occurred while fetching info.' });
        }
    },

    async handleScan(interaction) {
        const syncDatabase = interaction.options.getBoolean('sync-database') || false;
        const guild = interaction.guild;
    
        await interaction.deferReply({ ephemeral: true });
    
        try {
            const serverCategories = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildCategory && ch.name.endsWith("'s Archive"));
            const dbArchives = await getAllArchives(); 
    
            const serverArchiveNames = new Set(serverCategories.map(c => c.name.replace(/'s Archive$/, '')));
            const dbArchiveNames = new Set(dbArchives.map(a => a.name));
    
            const newOnServer = [...serverArchiveNames].filter(name => !dbArchiveNames.has(name));
            const missingFromServer = [...dbArchiveNames].filter(name => !serverArchiveNames.has(name));
    
            const report = { new: newOnServer, missing: missingFromServer, synced: 0, removed: 0, errors: [] };
    
            if (syncDatabase) {
                for (const archiveName of newOnServer) {
                    try {
                        const category = serverCategories.find(c => c.name.startsWith(archiveName));
                        const perms = category.permissionOverwrites.cache;
                        const ownerPerm = perms.find(p => p.type === 1 && p.allow.has(PermissionFlagsBits.ManageMessages));
                        
                        if (ownerPerm) {
                            const author = await guild.members.fetch(ownerPerm.id);
                            const archiveData = { name: archiveName, authorId: author.id, categoryId: category.id, createdAt: category.createdAt, enabled: true };
                            await saveArchiveData(archiveData);
                            report.synced++;
                        } else {
                            report.errors.push(`Could not find owner for new archive '${archiveName}'`);
                        }
                    } catch(err) {
                        report.errors.push(`Failed to sync new archive '${archiveName}': ${err.message}`);
                    }
                }
                
                for (const archiveName of missingFromServer) {
                    await deleteArchiveData(archiveName);
                    report.removed++;
                }
            }
    
            const embed = new EmbedBuilder()
                .setColor(report.new.length > 0 || report.missing.length > 0 ? '#0099FF' : '#00FF00')
                .setTitle('🔍 Archive Scan & Sync Report')
                .setDescription(`Found **${serverCategories.size}** categories on server and **${dbArchives.length}** archives in database.`)
                .setTimestamp();
    
            if (newOnServer.length > 0) embed.addFields({ name: `Found ${newOnServer.length} New Archives`, value: newOnServer.slice(0, 25).map(name => `+ ${name}`).join('\n') || 'None', inline: true });
            if (missingFromServer.length > 0) embed.addFields({ name: `Found ${missingFromServer.length} Missing Archives`, value: missingFromServer.slice(0, 25).map(name => `- ${name}`).join('\n') || 'None', inline: true });
            embed.addFields({ name: 'Database Sync', value: syncDatabase ? `✅ Sync complete. Added **${report.synced}** and removed **${report.removed}** from DB.` : 'ℹ️ Ran in read-only mode. No changes were made.' });
            if (report.errors.length > 0) embed.addFields({ name: '❌ Errors during sync', value: report.errors.join('\n') });
    
            await interaction.editReply({ embeds: [embed] });
    
        } catch (error) {
            console.error('Error scanning archives:', error);
            await interaction.editReply({ content: '❌ An error occurred while scanning for archives.' });
        }
    }
};
