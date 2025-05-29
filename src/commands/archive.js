// src/commands/archive.js
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const database = require('../utils/database');
const { getArchiveData, getArchiveStats } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('archive')
        .setDescription('Manage code archives')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new code archive with forum channels')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name for the archive (without "\'s Archive")')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('author')
                        .setDescription('The author of this archive (defaults to you)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an entire archive and all its channels')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the archive to delete')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('confirm')
                        .setDescription('Confirm you want to delete this archive (THIS CANNOT BE UNDONE)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable posting permissions for an archive')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the archive to disable')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable posting permissions for an archive')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the archive to enable')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get information about archives')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Get archive info for a specific user')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Get info for a specific archive name')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('scan')
                .setDescription('Scan the server for existing archive categories and channels')
                .addBooleanOption(option =>
                    option.setName('update-database')
                        .setDescription('Update the database with found archives (default: false)')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
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
        const archiveName = interaction.options.getString('name');
        const author = interaction.options.getUser('author') || interaction.user;
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if archive already exists
            const existingArchive = await getArchiveData(null, archiveName);
            if (existingArchive) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('⚠️ Archive Already Exists')
                    .setDescription(`An archive named "${archiveName}" already exists.`);
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Create the archive category
            const categoryName = `${archiveName}'s Archive`;
            const category = await guild.channels.create({
                name: categoryName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            // Create the main forum channel (text channel)
            const forumChannel = await guild.channels.create({
                name: 'forum',
                type: ChannelType.GuildText,
                parent: category.id,
                topic: `General discussion and questions for ${archiveName}'s Archive`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.UseExternalEmojis
                        ]
                    }
                ]
            });

            // Create example/project channels with restricted permissions (organized by category)
            const channelGroups = [
                // Block-related
                { name: 'block-examples', description: 'Block-related code examples' },
                { name: 'block-projects', description: 'Block-related projects' },
                
                // Command-related
                { name: 'command-example', description: 'Command code examples' },
                { name: 'command-projects', description: 'Command projects' },
                
                // Entity-related
                { name: 'entity-examples', description: 'Entity-related code examples' },
                { name: 'entity-projects', description: 'Entity-related projects' },
                
                // Item-related
                { name: 'item-examples', description: 'Item-related code examples' },
                { name: 'item-projects', description: 'Item-related projects' },
                
                // Misc
                { name: 'misc-examples', description: 'Miscellaneous code examples' },
                { name: 'misc-projects', description: 'Miscellaneous projects' },
                
                // Particles
                { name: 'particles-examples', description: 'Particle-related code examples' },
                { name: 'particles-projects', description: 'Particle-related projects' },
                
                // JavaScript
                { name: 'javascript-examples', description: 'JavaScript code examples' },
                { name: 'javascript-functional', description: 'Functional JavaScript code' },
                { name: 'javascript-projects', description: 'JavaScript projects' },
                
                // Audio
                { name: 'sound_effects', description: 'Sound effect examples' },
                { name: 'music-assets', description: 'Music and audio assets' }
            ];

            const createdChannels = [];

            for (const channelType of channelGroups) {
                const channel = await guild.channels.create({
                    name: channelType.name,
                    type: ChannelType.GuildForum,
                    parent: category.id,
                    topic: channelType.description,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                            deny: [
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.CreatePublicThreads,
                                PermissionFlagsBits.SendMessagesInThreads
                            ]
                        },
                        {
                            id: author.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.CreatePublicThreads,
                                PermissionFlagsBits.SendMessagesInThreads,
                                PermissionFlagsBits.ManageThreads,
                                PermissionFlagsBits.ManageMessages
                            ]
                        }
                    ]
                });
                createdChannels.push(channel);
            }

            // Create working-notes channel (forum for admin/author only)
            const workingNotesChannel = await guild.channels.create({
                name: 'working-notes',
                type: ChannelType.GuildForum,
                parent: category.id,
                topic: `Private working notes for ${archiveName}'s Archive`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: author.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.CreatePublicThreads,
                            PermissionFlagsBits.SendMessagesInThreads,
                            PermissionFlagsBits.ManageThreads,
                            PermissionFlagsBits.ManageMessages
                        ]
                    },
                    // Add server admins
                    ...guild.members.cache
                        .filter(member => member.permissions.has(PermissionFlagsBits.Administrator))
                        .map(member => ({
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.CreatePublicThreads,
                                PermissionFlagsBits.SendMessagesInThreads
                            ]
                        }))
                ]
            });

            // Save archive data to database
            const archiveData = {
                name: archiveName,
                authorId: author.id,
                categoryId: category.id,
                forumChannelId: forumChannel.id,
                workingNotesChannelId: workingNotesChannel.id,
                channels: createdChannels.map(ch => ({ id: ch.id, name: ch.name })),
                createdAt: new Date(),
                enabled: true
            };

            await database.saveArchiveData(archiveData);

            // Create success embed
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Archive Created Successfully!')
                .setDescription(`**${categoryName}** has been created with all necessary channels.`)
                .addFields([
                    {
                        name: '👤 Archive Author',
                        value: `${author.tag} (${author.id})`,
                        inline: true
                    },
                    {
                        name: '📁 Category',
                        value: `<#${category.id}>`,
                        inline: true
                    },
                    {
                        name: '💬 Forum Channel',
                        value: `<#${forumChannel.id}>`,
                        inline: true
                    },
                    {
                        name: '📝 Working Notes',
                        value: `<#${workingNotesChannel.id}> (Private)`,
                        inline: true
                    },
                    {
                        name: '📊 Total Channels Created',
                        value: `${createdChannels.length + 2} channels`,
                        inline: true
                    }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Send welcome message to the working notes channel
            const welcomeThread = await workingNotesChannel.threads.create({
                name: `Welcome to ${archiveName}'s Archive!`,
                message: {
                    embeds: [new EmbedBuilder()
                        .setColor('#0099FF')
                        .setTitle(`Welcome to ${archiveName}'s Archive!`)
                        .setDescription('This is your private working notes forum. Use this space to:\n\n• Plan your archive structure\n• Draft code examples\n• Keep track of TODO items\n• Store temporary notes\n\nOnly you and server administrators can see this forum.')
                        .addFields([
                            {
                                name: '🎯 Quick Tips',
                                value: '• Use the forum channels to organize your code examples\n• Each forum channel is restricted to you only\n• The main "forum" channel is open for community discussion\n• Use `/archive info` to see your archive statistics'
                            }
                        ])
                        .setTimestamp()
                    ]
                }
            });

        } catch (error) {
            console.error('Error creating archive:', error);
            await interaction.editReply({
                content: '❌ An error occurred while creating the archive. Please try again or contact an administrator.',
            });
        }
    },

    async handleDelete(interaction) {
        const archiveName = interaction.options.getString('name');
        const confirm = interaction.options.getBoolean('confirm');
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        if (!confirm) {
            const embed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('⚠️ Confirmation Required')
                .setDescription('You must set the `confirm` option to `true` to delete an archive.\n\n**WARNING: This action cannot be undone!**');
            
            return await interaction.editReply({ embeds: [embed] });
        }

        try {
            // Get archive data
            const archive = await getArchiveData(null, archiveName);
            if (!archive) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('❌ Archive Not Found')
                    .setDescription(`No archive found with the name "${archiveName}"`);
                
                return await interaction.editReply({ embeds: [embed] });
            }

            let deletedChannels = 0;
            let errors = [];

            // Delete the category and all its channels
            try {
                const category = guild.channels.cache.get(archive.categoryId);
                if (category) {
                    // Delete all channels in the category
                    const channelsInCategory = guild.channels.cache.filter(ch => ch.parentId === category.id);
                    
                    for (const [channelId, channel] of channelsInCategory) {
                        try {
                            await channel.delete();
                            deletedChannels++;
                        } catch (err) {
                            errors.push(`Failed to delete channel ${channel.name}: ${err.message}`);
                        }
                    }

                    // Delete the category itself
                    await category.delete();
                    deletedChannels++;
                }
            } catch (error) {
                errors.push(`Failed to delete category: ${error.message}`);
            }

            // Remove from database
            await database.deleteArchiveData(archiveName);

            // Create result embed
            const embed = new EmbedBuilder()
                .setColor(errors.length > 0 ? '#FF9900' : '#00FF00')
                .setTitle(errors.length > 0 ? '⚠️ Archive Partially Deleted' : '✅ Archive Deleted Successfully')
                .setDescription(`Archive "${archiveName}" has been ${errors.length > 0 ? 'partially ' : ''}deleted.`)
                .addFields([
                    {
                        name: '📊 Statistics',
                        value: `Deleted ${deletedChannels} channels`,
                        inline: true
                    }
                ]);

            if (errors.length > 0) {
                embed.addFields([
                    {
                        name: '❌ Errors',
                        value: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n... and ${errors.length - 3} more errors` : ''),
                        inline: false
                    }
                ]);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error deleting archive:', error);
            await interaction.editReply({
                content: '❌ An error occurred while deleting the archive. Please try again or contact an administrator.',
            });
        }
    },

    async handleDisable(interaction) {
        const archiveName = interaction.options.getString('name');
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get archive data
            const archive = await getArchiveData(null, archiveName);
            if (!archive) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('❌ Archive Not Found')
                    .setDescription(`No archive found with the name "${archiveName}"`);
                
                return await interaction.editReply({ embeds: [embed] });
            }

            let updatedChannels = 0;
            let errors = [];

            // Disable permissions for all forum channels
            for (const channelData of archive.channels) {
                try {
                    const channel = guild.channels.cache.get(channelData.id);
                    if (channel && channel.type === ChannelType.GuildForum) {
                        await channel.permissionOverwrites.edit(archive.authorId, {
                            SendMessages: false,
                            CreatePublicThreads: false,
                            SendMessagesInThreads: false
                        });
                        updatedChannels++;
                    }
                } catch (err) {
                    errors.push(`Failed to disable ${channelData.name}: ${err.message}`);
                }
            }

            // Update database
            await database.updateArchiveStatus(archiveName, false);

            // Create result embed
            const embed = new EmbedBuilder()
                .setColor(errors.length > 0 ? '#FF9900' : '#00FF00')
                .setTitle(errors.length > 0 ? '⚠️ Archive Partially Disabled' : '🔒 Archive Disabled Successfully')
                .setDescription(`Archive "${archiveName}" posting permissions have been ${errors.length > 0 ? 'partially ' : ''}disabled.`)
                .addFields([
                    {
                        name: '📊 Statistics',
                        value: `Updated ${updatedChannels} channels`,
                        inline: true
                    },
                    {
                        name: '👤 Author',
                        value: `<@${archive.authorId}>`,
                        inline: true
                    }
                ]);

            if (errors.length > 0) {
                embed.addFields([
                    {
                        name: '❌ Errors',
                        value: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n... and ${errors.length - 3} more errors` : ''),
                        inline: false
                    }
                ]);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error disabling archive:', error);
            await interaction.editReply({
                content: '❌ An error occurred while disabling the archive. Please try again or contact an administrator.',
            });
        }
    },

    async handleEnable(interaction) {
        const archiveName = interaction.options.getString('name');
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get archive data
            const archive = await getArchiveData(null, archiveName);
            if (!archive) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('❌ Archive Not Found')
                    .setDescription(`No archive found with the name "${archiveName}"`);
                
                return await interaction.editReply({ embeds: [embed] });
            }

            let updatedChannels = 0;
            let errors = [];

            // Enable permissions for all forum channels
            for (const channelData of archive.channels) {
                try {
                    const channel = guild.channels.cache.get(channelData.id);
                    if (channel && channel.type === ChannelType.GuildForum) {
                        await channel.permissionOverwrites.edit(archive.authorId, {
                            ViewChannel: true,
                            ReadMessageHistory: true,
                            SendMessages: true,
                            CreatePublicThreads: true,
                            SendMessagesInThreads: true,
                            ManageThreads: true,
                            ManageMessages: true
                        });
                        updatedChannels++;
                    }
                } catch (err) {
                    errors.push(`Failed to enable ${channelData.name}: ${err.message}`);
                }
            }

            // Update database
            await database.updateArchiveStatus(archiveName, true);

            // Create result embed
            const embed = new EmbedBuilder()
                .setColor(errors.length > 0 ? '#FF9900' : '#00FF00')
                .setTitle(errors.length > 0 ? '⚠️ Archive Partially Enabled' : '🔓 Archive Enabled Successfully')
                .setDescription(`Archive "${archiveName}" posting permissions have been ${errors.length > 0 ? 'partially ' : ''}enabled.`)
                .addFields([
                    {
                        name: '📊 Statistics',
                        value: `Updated ${updatedChannels} channels`,
                        inline: true
                    },
                    {
                        name: '👤 Author',
                        value: `<@${archive.authorId}>`,
                        inline: true
                    }
                ]);

            if (errors.length > 0) {
                embed.addFields([
                    {
                        name: '❌ Errors',
                        value: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n... and ${errors.length - 3} more errors` : ''),
                        inline: false
                    }
                ]);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error enabling archive:', error);
            await interaction.editReply({
                content: '❌ An error occurred while enabling the archive. Please try again or contact an administrator.',
            });
        }
    },

    async handleInfo(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const archiveName = interaction.options.getString('name');
        
        await interaction.deferReply();

        try {
            let archives;
            
            if (archiveName) {
                // Get specific archive
                const archive = await getArchiveData(null, archiveName);
                archives = archive ? [archive] : [];
            } else {
                // Get all archives for the user
                archives = await getArchiveData(targetUser.id);
            }

            if (archives.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('📁 No Archives Found')
                    .setDescription(
                        archiveName 
                            ? `No archive found with the name "${archiveName}"`
                            : `${targetUser.tag} doesn't have any archives yet.`
                    );
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get statistics
            const stats = await getArchiveStats(targetUser.id);

            if (archiveName && archives.length === 1) {
                // Show detailed info for specific archive
                const archive = archives[0];
                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle(`📁 ${archive.name}'s Archive`)
                    .setDescription(`Detailed information for this archive`)
                    .addFields([
                        {
                            name: '👤 Author',
                            value: `<@${archive.authorId}>`,
                            inline: true
                        },
                        {
                            name: '📅 Created',
                            value: `<t:${Math.floor(new Date(archive.createdAt).getTime() / 1000)}:R>`,
                            inline: true
                        },
                        {
                            name: '📊 Channels',
                            value: `${archive.channels ? archive.channels.length : 'Unknown'} channels`,
                            inline: true
                        },
                        {
                            name: '🔐 Status',
                            value: archive.enabled !== false ? '🔓 Enabled' : '🔒 Disabled',
                            inline: true
                        },
                        {
                            name: '🔗 Quick Links',
                            value: [
                                `**Forum:** <#${archive.forumChannelId}>`,
                                `**Working Notes:** <#${archive.workingNotesChannelId}>`,
                                `**Category:** <#${archive.categoryId}>`
                            ].join('\n'),
                            inline: false
                        }
                    ])
                    .setTimestamp();

                if (archive.channels && archive.channels.length > 0) {
                    const channelList = archive.channels
                        .slice(0, 10) // Limit to first 10 channels
                        .map(ch => `• ${ch.name}`)
                        .join('\n');
                    
                    embed.addFields([{
                        name: '📋 Archive Channels',
                        value: channelList + (archive.channels.length > 10 ? `\n... and ${archive.channels.length - 10} more` : ''),
                        inline: false
                    }]);
                }

                await interaction.editReply({ embeds: [embed] });
            } else {
                // Show overview of all archives
                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle(`📚 ${targetUser.tag}'s Archives`)
                    .setDescription(`Overview of all archives and statistics`)
                    .addFields([
                        {
                            name: '📊 Statistics',
                            value: [
                                `**Total Archives:** ${stats.totalArchives}`,
                                `**Total Examples:** ${stats.totalExamples}`,
                                `**Categories Used:** ${stats.categoriesUsed.length}`
                            ].join('\n'),
                            inline: true
                        }
                    ])
                    .setTimestamp();

                if (stats.categoriesUsed.length > 0) {
                    embed.addFields([{
                        name: '🏷️ Categories',
                        value: stats.categoriesUsed.slice(0, 5).join(', ') + 
                               (stats.categoriesUsed.length > 5 ? ` +${stats.categoriesUsed.length - 5} more` : ''),
                        inline: true
                    }]);
                }

                // List archives
                if (archives.length > 0) {
                    const archiveList = archives
                        .slice(0, 10)
                        .map(archive => {
                            const createdDate = new Date(archive.createdAt);
                            const status = archive.enabled !== false ? '🔓' : '🔒';
                            return `${status} **${archive.name}'s Archive**\n` +
                                   `Created: <t:${Math.floor(createdDate.getTime() / 1000)}:R>\n` +
                                   `Forum: <#${archive.forumChannelId}>`;
                        })
                        .join('\n\n');

                    embed.addFields([{
                        name: '📁 Archives',
                        value: archiveList + (archives.length > 10 ? `\n\n... and ${archives.length - 10} more archives` : ''),
                        inline: false
                    }]);
                }

                // Recent activity
                if (stats.recentActivity && stats.recentActivity.length > 0) {
                    const recentList = stats.recentActivity
                        .slice(0, 3)
                        .map(example => `• ${example.title || 'Untitled'} (${example.category || 'misc'})`)
                        .join('\n');

                    embed.addFields([{
                        name: '🕒 Recent Activity',
                        value: recentList,
                        inline: false
                    }]);
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error fetching archive info:', error);
            await interaction.editReply({
                content: '❌ An error occurred while fetching archive information.',
            });
        }
    },

async handleScan(interaction) {
    const updateDatabase = interaction.options.getBoolean('update-database') || false;
    const guild = interaction.guild;

    await interaction.deferReply({ ephemeral: true });

    try {
        // Get all categories that match the archive pattern
        const categories = guild.channels.cache.filter(ch => 
            ch.type === ChannelType.GuildCategory && 
            ch.name.endsWith("'s Archive")
        );

        const foundArchives = [];
        const errors = [];

        for (const [categoryId, category] of categories) {
            try {
                // Extract archive name from category name
                const archiveName = category.name.replace(/'s Archive$/, '');
                
                // Get all channels in this category
                const channelsInCategory = guild.channels.cache.filter(ch => 
                    ch.parentId === categoryId
                );

                // Find the required channels
                const forumChannel = channelsInCategory.find(ch => 
                    ch.type === ChannelType.GuildText && 
                    ch.name === 'forum'
                );

                const workingNotesChannel = channelsInCategory.find(ch => 
                    ch.type === ChannelType.GuildForum && 
                    ch.name === 'working-notes'
                );

                // Find all forum channels (excluding working-notes)
                const forumChannels = channelsInCategory.filter(ch => 
                    ch.type === ChannelType.GuildForum && 
                    ch.name !== 'working-notes'
                ).map(ch => ({ id: ch.id, name: ch.name }));

                // Try to find the author by checking permission overwrites
                let authorId = null;
                if (workingNotesChannel) {
                    // Get the first user with view permissions in working notes
                    const overwrites = workingNotesChannel.permissionOverwrites.cache;
                    const userOverwrite = overwrites.find(ow => 
                        ow.type === 1 && // Type 1 is for member
                        ow.allow.has(PermissionFlagsBits.ViewChannel)
                    );
                    if (userOverwrite) {
                        authorId = userOverwrite.id;
                    }
                }

                // If we couldn't find author from working notes, try forum channels
                if (!authorId && forumChannels.length > 0) {
                    const sampleForum = guild.channels.cache.get(forumChannels[0].id);
                    if (sampleForum) {
                        const overwrites = sampleForum.permissionOverwrites.cache;
                        const userOverwrite = overwrites.find(ow => 
                            ow.type === 1 && // Type 1 is for member
                            ow.allow.has(PermissionFlagsBits.SendMessages)
                        );
                        if (userOverwrite) {
                            authorId = userOverwrite.id;
                        }
                    }
                }

                // If still no author, try to find user by username fallback
                if (!authorId) {
                    // Try to find a user with matching username/display name
                    const potentialUser = guild.members.cache.find(member => {
                        // Check exact username match (case insensitive)
                        if (member.user.username.toLowerCase() === archiveName.toLowerCase()) {
                            return true;
                        }
                        // Check display name match (case insensitive)
                        if (member.displayName && member.displayName.toLowerCase() === archiveName.toLowerCase()) {
                            return true;
                        }
                        // Check global display name (case insensitive)
                        if (member.user.globalName && member.user.globalName.toLowerCase() === archiveName.toLowerCase()) {
                            return true;
                        }
                        return false;
                    });

                    if (potentialUser) {
                        authorId = potentialUser.id;
                    } else {
                        errors.push(`Could not determine author for archive "${archiveName}" - no permissions found and no matching username`);
                        continue;
                    }
                }

                const archiveData = {
                    name: archiveName,
                    authorId,
                    categoryId: category.id,
                    forumChannelId: forumChannel?.id || null,
                    workingNotesChannelId: workingNotesChannel?.id || null,
                    channels: forumChannels,
                    createdAt: category.createdAt || new Date(),
                    enabled: true
                };

                foundArchives.push(archiveData);

                // Update database if requested
                if (updateDatabase) {
                    try {
                        await database.saveArchiveData(archiveData);
                    } catch (err) {
                        errors.push(`Failed to save archive "${archiveName}" to database: ${err.message}`);
                    }
                }
            } catch (err) {
                errors.push(`Error processing category "${category.name}": ${err.message}`);
            }
        }

        // Create result embed
        const embed = new EmbedBuilder()
            .setColor(errors.length > 0 ? '#FF9900' : '#00FF00')
            .setTitle('🔍 Archive Scan Results')
            .setDescription(`Scanned server for archive categories and channels.`)
            .addFields([
                {
                    name: '📊 Found Archives',
                    value: foundArchives.length.toString(),
                    inline: true
                },
                {
                    name: '🔄 Database Updated',
                    value: updateDatabase ? 'Yes' : 'No',
                    inline: true
                }
            ]);

        if (foundArchives.length > 0) {
            const archiveList = foundArchives
                .slice(0, 5)
                .map(archive => `• ${archive.name}'s Archive (by <@${archive.authorId}>)`)
                .join('\n');

            embed.addFields([{
                name: '📋 Found Archives',
                value: archiveList + (foundArchives.length > 5 ? `\n... and ${foundArchives.length - 5} more` : ''),
                inline: false
            }]);
        }

        if (errors.length > 0) {
            embed.addFields([{
                name: '❌ Errors',
                value: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''),
                inline: false
            }]);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error scanning archives:', error);
        await interaction.editReply({
            content: '❌ An error occurred while scanning for archives. Please try again or contact an administrator.',
        });
    }
}
};