const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const JavaScriptObfuscator = require('javascript-obfuscator');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Script Config')
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        // Defer the initial reply to prevent timeout
        await interaction.deferReply({ ephemeral: true });

        const message = interaction.targetMessage;
        let code = '';

        // Try to get code from attachment first
        if (message.attachments.size > 0) {
            const jsFile = message.attachments.find(att => att.name.endsWith('.js'));
            if (jsFile) {
                code = await (await fetch(jsFile.url)).text();
            }
        }

        // If no code from attachment, try to get from message content
        if (!code) {
            code = extractCodeFromMessage(message.content);
        }

        if (!code.trim()) {
            return await interaction.editReply({
                content: '❌ No JavaScript code found in the selected message or its attachments!',
            });
        }

        // Create the selection menu
        const menu = new StringSelectMenuBuilder()
            .setCustomId('script_config_menu')
            .setPlaceholder('Choose a configuration option...')
            .addOptions([
                {
                    label: 'Obfuscate Code',
                    description: 'Makes the code unreadable to protect its logic.',
                    value: 'obfuscate_code',
                    emoji: '🔒'
                },
                {
                    label: 'Remove Comments',
                    description: 'Strips all comments from the code.',
                    value: 'remove_comments',
                    emoji: '📝'
                },
                {
                    label: 'Minify Code',
                    description: 'Removes comments and whitespace to reduce size.',
                    value: 'minify_code',
                    emoji: '📦'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const reply = await interaction.editReply({
            content: 'Please select an action to perform on the script:',
            components: [row],
        });

        
        collector.on('collect', async (menuInteraction) => {
            await menuInteraction.deferReply({ ephemeral: true });

            const selectedValue = menuInteraction.values[0];
            let processedCode = '';
            let resultMessage = '';

            try {
                switch (selectedValue) {
                    case 'obfuscate_code':
                        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                            compact: true,
                            controlFlowFlattening: true,
                        });
                        processedCode = obfuscationResult.getObfuscatedCode();
                        resultMessage = '🔒 Here is the obfuscated code:';
                        break;

                    case 'remove_comments':
                        // Regex to remove single-line and multi-line comments
                        processedCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
                        resultMessage = '📝 Here is the code with comments removed:';
                        break;
                    
                    case 'minify_code':
                        // Remove comments and then collapse multiple newlines/spaces
                        let noComments = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
                        processedCode = noComments.replace(/^\s*[\r\n]/gm, '').trim();
                        resultMessage = '📦 Here is the minified code:';
                        break;
                }

                // Check length and reply with embed or file
                const DESCRIPTION_LIMIT = 4000;
                if (processedCode.length <= DESCRIPTION_LIMIT) {
                    await menuInteraction.editReply({
                        content: resultMessage,
                        embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`\`\`\`javascript\n${processedCode}\`\`\``)]
                    });
                } else {
                    const buffer = Buffer.from(processedCode, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, { name: 'processed_script.js' });
                    await menuInteraction.editReply({
                        content: resultMessage + "\nThe resulting code was too long to display, so it's attached as a file.",
                        files: [attachment]
                    });
                }

            } catch (error) {
                 await menuInteraction.editReply({
                    content: `❌ An error occurred while processing the script: \`\`\`${error.message}\`\`\``
                });
            }


            // Disable the menu after selection
            await interaction.editReply({ components: [] });
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'Action timed out.', components: [] });
            }
        });
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
    // If no code block, return empty to signify no code found in content
    return '';
}