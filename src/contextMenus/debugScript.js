const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const { analyzeJavaScript } = require('../utils/codeAnalyzer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Debug Script')
        .setType(ApplicationCommandType.Message),
    
    async execute(interaction) {
        const message = interaction.targetMessage;
        
        try {
            // Check for attachments first
            if (message.attachments.size > 0) {
                await handleAttachments(interaction, message);
                return;
            }
            
            // If no attachments, process message content
            const code = extractCodeFromMessage(message.content);
            
            if (!code.trim()) {
                return await interaction.reply({
                    content: '❌ No code found in the selected message!',
                    ephemeral: true
                });
            }
            
            await analyzeAndReply(interaction, code, message);
            
        } catch (error) {
            console.error('Debug analysis error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while analyzing the code. Please try again.',
            });
        }
    }
};

async function handleAttachments(interaction, message) {
    await interaction.deferReply({ ephemeral: true });
    
    const jsFiles = message.attachments.filter(att => 
        att.name.endsWith('.js') || att.contentType === 'application/javascript'
    );
    
    if (jsFiles.size === 0) {
        return await interaction.editReply({
            content: '❌ No JavaScript files found in attachments!',
        });
    }
    
    // Analyze each JS file
    const results = [];
    for (const [_, attachment] of jsFiles) {
        try {
            const response = await fetch(attachment.url);
            const code = await response.text();
            results.push({
                filename: attachment.name,
                analysis: analyzeJavaScript(code)
            });
        } catch (error) {
            console.error(`Error analyzing attachment ${attachment.name}:`, error);
            results.push({
                filename: attachment.name,
                error: 'Failed to analyze file'
            });
        }
    }
    
    // Create embeds for each analysis
    const embeds = results.map(result => {
        const embed = new EmbedBuilder()
            .setColor('#00D9FF')
            .setTitle(`🔍 ${result.filename || 'Attachment'} Analysis`)
            .setDescription(`**Original Message by:** ${message.author.tag}`);
        
        if (result.error) {
            embed.addFields([{
                name: '❌ Error',
                value: result.error,
                inline: false
            }]);
            return embed;
        }
        
        const { analysis } = result;
        
        if (analysis.errors.length > 0) {
            embed.addFields([{
                name: '❌ Syntax Errors',
                value: analysis.errors.slice(0, 5).map(error => `• ${error}`).join('\n') + 
                      (analysis.errors.length > 5 ? `\n...and ${analysis.errors.length - 5} more` : ''),
                inline: false
            }]);
        }
        
        if (analysis.warnings.length > 0) {
            embed.addFields([{
                name: '⚠️ Warnings',
                value: analysis.warnings.slice(0, 5).map(warning => `• ${warning}`).join('\n') + 
                      (analysis.warnings.length > 5 ? `\n...and ${analysis.warnings.length - 5} more` : ''),
                inline: false
            }]);
        }
        
        if (analysis.suggestions.length > 0) {
            embed.addFields([{
                name: '💡 Suggestions',
                value: analysis.suggestions.slice(0, 5).map(suggestion => `• ${suggestion}`).join('\n') + 
                      (analysis.suggestions.length > 5 ? `\n...and ${analysis.suggestions.length - 5} more` : ''),
                inline: false
            }]);
        }
        
        if (analysis.bedrockSpecific.length > 0) {
            embed.addFields([{
                name: '🎮 Bedrock-Specific Notes',
                value: analysis.bedrockSpecific.slice(0, 5).map(note => `• ${note}`).join('\n') + 
                      (analysis.bedrockSpecific.length > 5 ? `\n...and ${analysis.bedrockSpecific.length - 5} more` : ''),
                inline: false
            }]);
        }
        
        if (analysis.errors.length === 0 && analysis.warnings.length === 0) {
            embed.addFields([{
                name: '✅ Analysis Result',
                value: 'No obvious syntax errors detected! Code appears to be well-formed.',
                inline: false
            }]);
        }
        
        return embed;
    });
    
    await interaction.editReply({ embeds });
}

function extractCodeFromMessage(content) {
    // Check for code blocks
    const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)```/gi;
    const codeMatches = content.match(codeBlockRegex);
    
    if (codeMatches) {
        // Extract code from code blocks
        return codeMatches.map(block => 
            block.replace(/```(?:javascript|js)?\n?/, '').replace(/```$/, '')
        ).join('\n\n');
    }
    
    // Check for inline code
    const inlineCodeRegex = /`([^`]+)`/g;
    const inlineMatches = content.match(inlineCodeRegex);
    
    if (inlineMatches) {
        return inlineMatches.map(match => match.replace(/`/g, '')).join('\n');
    }
    
    // Use entire message content as potential code
    return content;
}

async function analyzeAndReply(interaction, code, message) {
    await interaction.deferReply({ ephemeral: true });
    
    const analysis = analyzeJavaScript(code);
    
    const embed = new EmbedBuilder()
        .setColor('#00D9FF')
        .setTitle('🔍 Code Debug Analysis')
        .setDescription(`**Original Message by:** ${message.author.tag}`)
        .addFields([{
            name: '📝 Code Preview',
            value: `\`\`\`javascript\n${code.length > 500 ? code.substring(0, 500) + '...' : code}\`\`\``,
            inline: false
        }])
        .setTimestamp();
    
    if (analysis.errors.length > 0) {
        embed.addFields([{
            name: '❌ Syntax Errors',
            value: analysis.errors.slice(0, 5).map(error => `• ${error}`).join('\n') + 
                  (analysis.errors.length > 5 ? `\n...and ${analysis.errors.length - 5} more` : ''),
            inline: false
        }]);
    }
    
    if (analysis.warnings.length > 0) {
        embed.addFields([{
            name: '⚠️ Warnings',
            value: analysis.warnings.slice(0, 5).map(warning => `• ${warning}`).join('\n') + 
                  (analysis.warnings.length > 5 ? `\n...and ${analysis.warnings.length - 5} more` : ''),
            inline: false
        }]);
    }
    
    if (analysis.suggestions.length > 0) {
        embed.addFields([{
            name: '💡 Suggestions',
            value: analysis.suggestions.slice(0, 5).map(suggestion => `• ${suggestion}`).join('\n') + 
                  (analysis.suggestions.length > 5 ? `\n...and ${analysis.suggestions.length - 5} more` : ''),
            inline: false
        }]);
    }
    
    if (analysis.bedrockSpecific.length > 0) {
        embed.addFields([{
            name: '🎮 Bedrock-Specific Notes',
            value: analysis.bedrockSpecific.slice(0, 5).map(note => `• ${note}`).join('\n') + 
                  (analysis.bedrockSpecific.length > 5 ? `\n...and ${analysis.bedrockSpecific.length - 5} more` : ''),
            inline: false
        }]);
    }
    
    if (analysis.errors.length === 0 && analysis.warnings.length === 0) {
        embed.addFields([{
            name: '✅ Analysis Result',
            value: 'No obvious syntax errors detected! Code appears to be well-formed.',
            inline: false
        }]);
    }
    
    await interaction.editReply({ embeds: [embed] });
}