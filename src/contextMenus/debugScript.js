const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');
const { analyzeJavaScript, addSemicolons, modernizeScript } = require('../utils/codeAnalyzer');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Debug Script')
        .setType(ApplicationCommandType.Message),
    
    async execute(interaction) {
        const message = interaction.targetMessage;
        
        try {
            let code = '';
            // Check for attachments first
            if (message.attachments.size > 0) {
                const jsFile = message.attachments.find(att => att.name.endsWith('.js'));
                if (!jsFile) {
                     return await interaction.reply({ content: '❌ No JavaScript file found in attachments!', ephemeral: true });
                }
                code = await(await fetch(jsFile.url)).text();
            } else {
                 code = extractCodeFromMessage(message.content);
            }
            
            if (!code.trim()) {
                return await interaction.reply({ content: '❌ No code found!', ephemeral: true });
            }
            
            await analyzeAndReply(interaction, code, message);
            
        } catch (error) {
            console.error('Debug analysis error:', error);
            await interaction.reply({ content: '❌ An error occurred while analyzing the code.', ephemeral: true });
        }
    }
};

function extractCodeFromMessage(content) {
    const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)```/gi;
    const codeMatches = content.match(codeBlockRegex);
    
    if (codeMatches) {
        return codeMatches.map(block => 
            block.replace(/```(?:javascript|js)?\n?/, '').replace(/```$/, '')
        ).join('\n\n');
    }
    return content;
}

async function analyzeAndReply(interaction, code, message) {
    await interaction.deferReply({ ephemeral: true });
    
    const analysis = analyzeJavaScript(code);
    const embed = createAnalysisEmbed(analysis, message);
    
    const components = [];
    const actionRow = new ActionRowBuilder();

    if (analysis.errors.length === 0) {
        const hasSemicolonWarning = analysis.warnings.some(w => w.includes('semicolon'));
        const hasModernizeWarning = analysis.warnings.some(w => w.includes('var') || w.includes('==='));

        if (hasSemicolonWarning) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('fix_semicolon')
                    .setLabel('Add Semicolons')
                    .setStyle(ButtonStyle.Primary)
            );
        }
        if (hasModernizeWarning) {
             actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('fix_modernize')
                    .setLabel('Modernize Script')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
    }

    if (actionRow.components.length > 0) {
        components.push(actionRow);
    }

    const reply = await interaction.editReply({ embeds: [embed], components });

    if (components.length > 0) {
        await setupButtonCollector(interaction, reply, code);
    }
}

async function setupButtonCollector(interaction, reply, originalCode) {
    const collector = reply.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000 // 60 seconds
    });

    collector.on('collect', async (buttonInteraction) => {
        let fixedCode;
        let replyMessage;

        switch (buttonInteraction.customId) {
            case 'fix_semicolon':
                fixedCode = addSemicolons(originalCode);
                replyMessage = "✨ Here is the code with semicolons added:";
                break;
            case 'fix_modernize':
                fixedCode = modernizeScript(originalCode);
                replyMessage = "✨ Here is the modernized script (`var` -> `let`, `==` -> `===`):";
                break;
            default:
                return buttonInteraction.reply({ content: "Unknown action!", ephemeral: true });
        }

        const DESCRIPTION_LIMIT = 4000;

        if (fixedCode.length <= DESCRIPTION_LIMIT) {
            // If code is short enough, send in an embed
            await buttonInteraction.reply({
                content: replyMessage,
                embeds: [
                    new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setDescription(`\`\`\`javascript\n${fixedCode}\`\`\``)
                ],
                ephemeral: true
            });
        } else {
            // If code is too long, send as a file
            const buffer = Buffer.from(fixedCode, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: 'fixed_script.js' });

            await buttonInteraction.reply({
                content: replyMessage + "\nThe corrected code was too long to display, so it's attached as a file.",
                files: [attachment],
                ephemeral: true
            });
        }

        const disabledRow = ActionRowBuilder.from(reply.components[0]);
        disabledRow.components.forEach(c => c.setDisabled(true));
        await interaction.editReply({ components: [disabledRow] });
        collector.stop();
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && reply.components.length > 0) {
            const disabledRow = ActionRowBuilder.from(reply.components[0]);
            disabledRow.components.forEach(c => c.setDisabled(true));
            interaction.editReply({ components: [disabledRow] }).catch(() => {});
        }
    });
}

function createAnalysisEmbed(analysis, message) {
    const embed = new EmbedBuilder()
        .setColor('#00D9FF')
        .setTitle(`🔍 Code Debug Analysis`)
        .setDescription(`**Original Message by:** ${message.author.tag}`)
        .setTimestamp();

    if (analysis.errors.length > 0) {
        embed.setColor('#E74C3C').addFields([{
            name: '❌ Syntax Errors',
            value: analysis.errors.slice(0, 5).map(e => `• ${e}`).join('\n')
        }]);
    }
    
    if (analysis.warnings.length > 0) {
        embed.setColor('#F1C40F').addFields([{
            name: '⚠️ Warnings',
            value: analysis.warnings.slice(0, 5).map(w => `• ${w}`).join('\n')
        }]);
    }
    
    if (analysis.errors.length === 0 && analysis.warnings.length === 0) {
        embed.setColor('#2ECC71').addFields([{
            name: '✅ Analysis Result',
            value: 'No obvious errors or warnings detected!'
        }]);
    }
    
    return embed;
}