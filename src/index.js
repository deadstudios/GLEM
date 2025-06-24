// src/index.js
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const consoleHandler = require('./console'); // Import the new console handler
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collections for commands
client.commands = new Collection();
client.contextMenus = new Collection();

// --- Command and Event Loading (Unchanged) ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

const contextMenusPath = path.join(__dirname, 'contextMenus');
if (fs.existsSync(contextMenusPath)) {
    const contextMenuFiles = fs.readdirSync(contextMenusPath).filter(file => file.endsWith('.js'));
    for (const file of contextMenuFiles) {
        const filePath = path.join(contextMenusPath, file);
        const contextMenu = require(filePath);
        client.contextMenus.set(contextMenu.data.name, contextMenu);
    }
}


client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('Minecraft', { type: ActivityType.Playing });
});

client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(`[Autocomplete Error]`, error);
        }
    } else if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Error executing command:', error);
            const reply = { content: 'There was an error executing this command!', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
            else await interaction.reply(reply);
        }
    } else if (interaction.isContextMenuCommand()) {
        const contextMenu = client.contextMenus.get(interaction.commandName);
        if (!contextMenu) return;
        try {
            await contextMenu.execute(interaction);
        } catch (error) {
            console.error('Error executing context menu:', error);
            const reply = { content: 'There was an error executing this command!', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
            else await interaction.reply(reply);
        }
    }
});

// --- Command Deployment ---
async function deployCommands() {
    const allCommands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        // Clear the cache to get the latest version of the command
        delete require.cache[require.resolve(`./commands/${file}`)];
        const command = require(`./commands/${file}`);
        allCommands.push(command.data.toJSON());
    }
    
    const contextMenusPath = path.join(__dirname, 'contextMenus');
    const contextMenuFiles = fs.existsSync(contextMenusPath) ? fs.readdirSync(contextMenusPath).filter(file => file.endsWith('.js')) : [];
    for (const file of contextMenuFiles) {
        delete require.cache[require.resolve(`./contextMenus/${file}`)];
        const contextMenu = require(`./contextMenus/${file}`);
        allCommands.push(contextMenu.data.toJSON());
    }

    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: allCommands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Failed to deploy commands:', error);
    }
}

// --- Bot Startup ---
deployCommands().then(() => {
    client.login(process.env.DISCORD_TOKEN);
});

// Initialize the console handler, passing the client and the deploy function
consoleHandler.initialize(client, deployCommands);

module.exports = { client, deployCommands };
