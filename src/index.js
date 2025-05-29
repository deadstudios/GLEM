// src/index.js
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collections for commands and context menus
client.commands = new Collection();
client.contextMenus = new Collection();

// Load slash commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Load context menu commands
const contextMenusPath = path.join(__dirname, 'contextMenus');
const contextMenuFiles = fs.readdirSync(contextMenusPath).filter(file => file.endsWith('.js'));

for (const file of contextMenuFiles) {
    const filePath = path.join(contextMenusPath, file);
    const contextMenu = require(filePath);
    client.contextMenus.set(contextMenu.data.name, contextMenu);
}

// Event handlers
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('Minecraft', { type: ActivityType.Playing });
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Error executing command:', error);
            const reply = { content: 'There was an error executing this command!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    } else if (interaction.isContextMenuCommand()) {
        const contextMenu = client.contextMenus.get(interaction.commandName);
        if (!contextMenu) return;

        try {
            await contextMenu.execute(interaction);
        } catch (error) {
            console.error('Error executing context menu:', error);
            const reply = { content: 'There was an error executing this command!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
});

// Register commands
async function deployCommands() {
    const commands = [];
    const contextMenuCommands = [];
    
    // Collect slash commands
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        commands.push(command.data.toJSON());
    }
    
    // Collect context menu commands
    for (const file of contextMenuFiles) {
        const contextMenu = require(path.join(contextMenusPath, file));
        contextMenuCommands.push(contextMenu.data.toJSON());
    }
    
    const allCommands = [...commands, ...contextMenuCommands];
    
    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: allCommands }
        );
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

// Deploy commands and start bot
deployCommands().then(() => {
    client.login(process.env.DISCORD_TOKEN);
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


// Shutdown handler
rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'stop') {
        console.log('Shutting down...');
        
        
        client.destroy()
            .then(() => {
                rl.close();
                process.exit(0);
            })
            .catch(err => {
                console.error('Error during shutdown:', err);
                rl.close();
                process.exit(1);
            });
    }
});

// Handle CTRL+C
process.on('SIGINT', () => {
    console.log('\nReceived shutdown signal');

    client.destroy()
        .then(() => {
            rl.close();
            process.exit(0);
        })
        .catch(err => {
            console.error('Error during shutdown:', err);
            rl.close();
            process.exit(1);
        });
});

module.exports = client;