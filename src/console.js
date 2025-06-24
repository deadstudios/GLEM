// src/console.js
const readline = require('readline');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const { getAllArchives, saveArchives } = require('./utils/database');

const COMMAND_PREFIX = '>';

let client;
let guild;
let deployCommands;

const commands = {
    // --- System Commands ---
    sys: {
        description: 'Core bot and system commands.',
        usage: 'sys <status|ping|heap>',
        execute: async (args) => {
            const subCommand = args[0] || 'status';
            switch(subCommand) {
                case 'status': {
                    const uptime = performance.now();
                    const memoryUsage = process.memoryUsage();
                    console.log('\n--- Bot Status ---');
                    console.log(`  - Status:     ${client.isReady() ? 'Online' : 'Offline'}`);
                    console.log(`  - Uptime:     ${Math.floor(uptime / 1000 / 60)} minutes`);
                    console.log(`  - Memory RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`);
                    console.log(`  - Guilds:     ${client.guilds.cache.size}`);
                    console.log('------------------\n');
                    break;
                }
                case 'ping': {
                    console.log('\n--- System Ping ---');
                    console.log(`  - WebSocket Latency: ${Math.round(client.ws.ping)}ms`);
                    console.log('-------------------\n');
                    break;
                }
                case 'heap': {
                    const memoryUsage = process.memoryUsage();
                     console.log('\n--- V8 Heap Statistics ---');
                     for (const [key, value] of Object.entries(memoryUsage)) {
                         console.log(`  - ${key.padEnd(20)} ${(value / 1024 / 1024).toFixed(2)} MB`);
                     }
                     console.log('--------------------------\n');
                     break;
                }
                default:
                    console.error(`[Console] Unknown 'sys' subcommand: ${subCommand}.`);
                    break;
            }
        }
    },
    // --- Development Commands ---
    dev: {
        description: 'Commands for development and debugging.',
        usage: 'dev <reload-commands|throw-error>',
        execute: async (args) => {
            const subCommand = args[0];
            switch(subCommand) {
                case 'reload-commands':
                    console.log('[Dev] Reloading application (/) commands...');
                    await deployCommands();
                    console.log('[Dev] Commands reloaded successfully.');
                    break;
                case 'throw-error':
                    console.log('[Dev] Intentionally throwing an error...');
                    throw new Error('This is a test error thrown from the console.');
                default:
                    console.error(`[Console] Unknown 'dev' subcommand.`);
                    break;
            }
        }
    },
    // --- Database Commands ---
    db: {
        description: 'Commands to interact with the database.',
        usage: 'db <stats|list|format>',
        execute: async (args) => {
            const subCommand = args[0];
            switch (subCommand) {
                case 'stats': {
                    const archives = await getAllArchives();
                    console.log('\n--- Database Stats ---');
                    console.log(`  - Total Archives: ${archives.length}`);
                    console.log('----------------------\n');
                    break;
                }
                case 'list': {
                    const archives = await getAllArchives();
                    console.log('\n--- Stored Archives ---');
                    if (archives.length === 0) {
                        console.log('  No archives found.');
                    } else {
                        archives.forEach(a => console.log(`  - "${a.name}" (Author ID: ${a.authorId})`));
                    }
                    console.log('-----------------------\n');
                    break;
                }
                case 'format':
                    await formatDatabase();
                    break;
                default:
                    console.error(`[Console] Unknown 'db' subcommand. Use 'db <stats|list|format>'.`);
                    break;
            }
        }
    },
     // --- General Commands ---
    help: {
        description: 'Displays a list of all available commands.',
        usage: 'help',
        execute: () => {
            console.log('\n--- Console Command Help ---');
            const commandEntries = Object.entries(commands);
            // Custom sort order
            const categoryOrder = ['sys', 'dev', 'db', 'stop', 'restart', 'help'];
            commandEntries.sort(([a], [b]) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b));

            for (const [name, { description, usage }] of commandEntries) {
                 console.log(`  ${(usage || name).padEnd(25)} # ${description}`);
            }
            console.log('----------------------------\n');
        }
    },
    stop: {
        description: 'Stops the bot gracefully.',
        usage: 'stop | exit',
        aliases: ['exit'],
        execute: async () => {
            console.log('[Console] Shutting down bot...');
            await client.destroy();
            console.log('[Console] Bot has been shut down.');
            process.exit(0);
        }
    },
    restart: {
        description: 'Restarts the bot (requires a process manager).',
        usage: 'restart',
        execute: async () => {
            console.log('[Console] Attempting to restart...');
            await client.destroy();
            console.log('[Console] Bot instance stopped. Firing restart signal.');
            process.exit(2); 
        }
    },
};

async function formatDatabase() {
    console.log('[DB Format] Starting database format migration...');
    if (!guild) {
        console.error('[DB Format] Error: Guild not available. Cannot fetch members.');
        return;
    }
    const archives = await getAllArchives();
    if (archives.length === 0) {
        console.log('[DB Format] No archives to format.');
        return;
    }
    const backupPath = path.join(__dirname, 'data', `archives.backup.${Date.now()}.json`);
    await fs.writeFile(backupPath, JSON.stringify(archives, null, 2));
    console.log(`[DB Format] IMPORTANT: A backup has been saved to: ${backupPath}`);
    const newArchives = [];
    let changes = 0;
    for (const archive of archives) {
        if (!archive.authorId) {
            newArchives.push(archive);
            continue;
        }
        try {
            const member = await guild.members.fetch(archive.authorId);
            const newName = member.displayName;
            if (archive.name !== newName) {
                console.log(`  - Formatting: "${archive.name}" -> "${newName}" for user ${member.user.tag}`);
                archive.name = newName;
                changes++;
            }
            newArchives.push(archive);
        } catch (error) {
            console.error(`  - Could not fetch member for authorId ${archive.authorId}. Keeping old name.`);
            newArchives.push(archive);
        }
    }
    await saveArchives(newArchives);
    console.log(`[DB Format] Migration complete. ${changes} archives were updated.`);
}

function initialize(discordClient, deployFunc) {
    client = discordClient;
    deployCommands = deployFunc;
    
    client.once('ready', () => {
        guild = client.guilds.cache.get(process.env.GUILD_ID);
        if(!guild) {
            console.error("[Console] FATAL: Could not find GUILD_ID. Some commands will not work.");
        }
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${COMMAND_PREFIX} `
    });

    rl.on('line', async (line) => {
        const [commandName, ...args] = line.trim().split(/\s+/);
        if (!commandName) {
            rl.prompt();
            return;
        }
        const command = commands[commandName] || Object.values(commands).find(c => c.aliases && c.aliases.includes(commandName));
        if (command) {
            try {
                await command.execute(args);
            } catch (error) {
                console.error(`[Console] Error executing command '${commandName}':`, error);
            }
        } else {
            console.log(`Unknown command: '${commandName}'. Type 'help' for a list of commands.`);
        }
        rl.prompt();
    });

    process.on('SIGINT', () => {
        commands.stop.execute();
    });
    
    console.log("[Console] Command handler initialized. Type 'help' for a list of commands.");
    rl.prompt();
}

module.exports = { initialize };
