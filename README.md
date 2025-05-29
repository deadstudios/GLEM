# GLEM 2.0 - GreatLibraryElectronicModerator

![Discord Bot](https://img.shields.io/badge/Discord-Bot-7289da?style=for-the-badge&logo=discord&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)
![Minecraft Bedrock](https://img.shields.io/badge/Minecraft-Bedrock-00B4D8?style=for-the-badge&logo=minecraft&logoColor=white)

A specialized Discord bot designed for The Great Library of Minecraftia

## Features

### Archive Management
- **Create Code Archives**: Automated category and channel creation for organized code storage
- **Permission Management**: Fine-grained access control for archive contributors
- **Archive Statistics**: Comprehensive analytics and insights for archive activity
- **Scan & Discovery**: Automatically detect and catalog existing archives
- **Enable/Disable Archives**: Flexible archive state management

### Code Analysis
- **JavaScript Debugging**: Context menu-based code analysis for quick troubleshooting
- **Bedrock-Specific Checks**: Specialized analysis for Minecraft Bedrock scripting patterns
- **Syntax Validation**: Real-time error detection and best practice suggestions
- **Performance Insights**: Optimization recommendations for Minecraft scripting

### Administrative Tools
- **Archive Scanning**: Bulk discovery and registration of existing archive structures
- **Database Management**: Persistent storage and retrieval of archive metadata
- **Permission Oversight**: Administrative controls for archive access and management

## Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- Discord application with bot token
- Discord server with appropriate permissions

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/deadstudios/GLEM.git
   cd glem-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id
   GUILD_ID=your_server_id
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## Commands

### /archive Commands (Administrator Only)

#### Create Archive
```
/archive create name:ArchiveName [author:@user]
```
Creates a comprehensive archive structure with:
- Main category: `{name}'s Archive`
- Forum channel for discussions
- Specialized channels for different code types:
  - Block examples/projects
  - Command examples/projects  
  - Entity examples/projects
  - Item examples/projects
  - JavaScript examples/functional/projects
  - Particle examples/projects
  - Miscellaneous examples/projects
  - Audio assets (sound effects, music)
- Private working notes forum

#### Manage Archives
```
/archive delete name:ArchiveName confirm:true
/archive enable name:ArchiveName
/archive disable name:ArchiveName
```

#### Information & Analytics
```
/archive info [user:@user] [name:ArchiveName]
/archive scan [update-database:true/false]
```

### Context Menu Commands

#### Debug Script
Right-click on any message → Apps → **Debug Script**

Analyzes JavaScript code with:
- Syntax error detection
- Bedrock-specific pattern recognition
- Performance optimization suggestions
- Best practice recommendations

## Architecture

### File Structure
```
src/
├── commands/
│   └── archive.js          # Archive management commands
├── contextMenus/
│   └── debugScript.js      # Code analysis context menu
├── utils/
│   ├── codeAnalyzer.js     # JavaScript analysis engine
│   └── database.js         # Data persistence layer
├── data/
│   └── archives.json       # Archive metadata storage
└── index.js               # Bot initialization and event handling
```

### Database Schema
Archives are stored in JSON format with the following structure:
```json
{
  "name": "string",
  "authorId": "string",
  "categoryId": "string",
  "forumChannelId": "string",
  "workingNotesChannelId": "string",
  "channels": [
    {"id": "string", "name": "string"}
  ],
  "createdAt": "ISO 8601 date",
  "enabled": "boolean"
}
```

## Configuration

### Bot Permissions Required
- **Administrator** (for archive management commands)
- **Manage Channels** (create/modify archive structure)
- **Manage Roles** (permission management)
- **Read Message History** (code analysis)
- **Send Messages** (command responses)
- **Use Slash Commands** (command registration)

### Channel Types Created
- **Guild Category**: Archive organization
- **Guild Text**: Forum discussions
- **Guild Forum**: Specialized code storage with threaded conversations

## Development and Ownership

GLEM 2.0 was developed by @deadisdeadxd and proudly brought to life by Dead Studios. The source code will be publicly availabl. Unless otherwise directed by ExcitedName, GLEM 2.0 will be hosted by Dead and Dead Studios. Ownership of GLEM 2.0 and its associated rights belong to ExcitedName and Excited Studios.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Issues & Support

- **Bug Reports**: [GitHub Issues](https://github.com/deadstudios/GLEM/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/deadstudios/GLEM/discussions)

## Acknowledgments

- Built for the Great Library of Minecraftia
- Inspired by the need for organized code archival and sharing
---

**GLEM 2.0** - Organizing knowledge, one archive at a time.