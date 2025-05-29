// src/contextMenus/debugScript.js
const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const { analyzeJavaScript } = require('../utils/codeAnalyzer');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Debug Script')
        .setType(ApplicationCommandType.Message),
    
    async execute(interaction) {
        const message = interaction.targetMessage;
        
        // Extract code from message
        let code = '';
        
        // Check for code blocks
        const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)```/gi;
        const codeMatches = message.content.match(codeBlockRegex);
        
        if (codeMatches) {
            // Extract code from code blocks
            code = codeMatches.map(block => 
                block.replace(/```(?:javascript|js)?\n?/, '').replace(/```$/, '')
            ).join('\n\n');
        } else {
            // Check for inline code
            const inlineCodeRegex = /`([^`]+)`/g;
            const inlineMatches = message.content.match(inlineCodeRegex);
            
            if (inlineMatches) {
                code = inlineMatches.map(match => match.replace(/`/g, '')).join('\n');
            } else {
                // Use entire message content as potential code
                code = message.content;
            }
        }
        
        if (!code.trim()) {
            return await interaction.reply({
                content: '❌ No code found in the selected message!',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const analysis = analyzeJavaScript(code);
            
            const embed = new EmbedBuilder()
                .setColor('#00D9FF')
                .setTitle('🔍 Code Debug Analysis')
                .setDescription(`**Original Message by:** ${message.author.tag}`)
                .addFields([
                    {
                        name: '📝 Code Preview',
                        value: `\`\`\`javascript\n${code.length > 500 ? code.substring(0, 500) + '...' : code}\`\`\``,
                        inline: false
                    }
                ])
                .setTimestamp();
            
            if (analysis.errors.length > 0) {
                embed.addFields([{
                    name: '❌ Syntax Errors',
                    value: analysis.errors.map(error => `• ${error}`).join('\n'),
                    inline: false
                }]);
            }
            
            if (analysis.warnings.length > 0) {
                embed.addFields([{
                    name: '⚠️ Warnings',
                    value: analysis.warnings.map(warning => `• ${warning}`).join('\n'),
                    inline: false
                }]);
            }
            
            if (analysis.suggestions.length > 0) {
                embed.addFields([{
                    name: '💡 Suggestions',
                    value: analysis.suggestions.map(suggestion => `• ${suggestion}`).join('\n'),
                    inline: false
                }]);
            }
            
            if (analysis.bedrockSpecific.length > 0) {
                embed.addFields([{
                    name: '🎮 Bedrock-Specific Notes',
                    value: analysis.bedrockSpecific.map(note => `• ${note}`).join('\n'),
                    inline: false
                }]);
            }
            
            // If no issues found
            if (analysis.errors.length === 0 && analysis.warnings.length === 0) {
                embed.addFields([{
                    name: '✅ Analysis Result',
                    value: 'No obvious syntax errors detected! Code appears to be well-formed.',
                    inline: false
                }]);
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Debug analysis error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while analyzing the code. Please try again.',
            });
        }
    }
};