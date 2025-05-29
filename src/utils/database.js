// src/utils/database.js
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ARCHIVES_FILE = path.join(DATA_DIR, 'archives.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Load archives data
async function loadArchives() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(ARCHIVES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

// Save archives data
async function saveArchives(archives) {
    await ensureDataDir();
    await fs.writeFile(ARCHIVES_FILE, JSON.stringify(archives, null, 2));
}

// Save new archive data
async function saveArchiveData(archiveData) {
    const archives = await loadArchives();
    
    // Check if archive with same name already exists
    const existingIndex = archives.findIndex(a => a.name.toLowerCase() === archiveData.name.toLowerCase());
    
    if (existingIndex !== -1) {
        // Update existing archive
        archives[existingIndex] = { ...archives[existingIndex], ...archiveData };
    } else {
        // Add new archive
        archives.push(archiveData);
    }
    
    await saveArchives(archives);
    return archiveData;
}

// Get archive data
async function getArchiveData(authorId = null, archiveName = null) {
    const archives = await loadArchives();
    
    if (archiveName) {
        // Find specific archive by name
        return archives.find(a => a.name.toLowerCase() === archiveName.toLowerCase()) || null;
    } else if (authorId) {
        // Find all archives by author
        return archives.filter(a => a.authorId === authorId);
    } else {
        // Return all archives
        return archives;
    }
}

// Delete archive data
async function deleteArchiveData(archiveName) {
    const archives = await loadArchives();
    const filteredArchives = archives.filter(a => a.name.toLowerCase() !== archiveName.toLowerCase());
    await saveArchives(filteredArchives);
    return true;
}

// Update archive status (enabled/disabled)
async function updateArchiveStatus(archiveName, enabled) {
    const archives = await loadArchives();
    const archiveIndex = archives.findIndex(a => a.name.toLowerCase() === archiveName.toLowerCase());
    
    if (archiveIndex !== -1) {
        archives[archiveIndex].enabled = enabled;
        archives[archiveIndex].lastModified = new Date();
        await saveArchives(archives);
        return archives[archiveIndex];
    }
    
    return null;
}

// Get archive statistics
async function getArchiveStats(authorId) {
    const archives = await loadArchives();
    const userArchives = archives.filter(a => a.authorId === authorId);
    
    const stats = {
        totalArchives: userArchives.length,
        totalExamples: 0,
        categoriesUsed: [],
        recentActivity: [],
        enabledArchives: userArchives.filter(a => a.enabled !== false).length,
        disabledArchives: userArchives.filter(a => a.enabled === false).length
    };
    
    // Calculate total examples (assuming each channel can have multiple examples)
    userArchives.forEach(archive => {
        if (archive.channels) {
            stats.totalExamples += archive.channels.length;
            
            // Extract categories from channel names
            archive.channels.forEach(channel => {
                const categoryMatch = channel.name.match(/^(\w+)-/);
                if (categoryMatch) {
                    const category = categoryMatch[1];
                    if (!stats.categoriesUsed.includes(category)) {
                        stats.categoriesUsed.push(category);
                    }
                }
            });
        }
    });
    
    // Sort archives by creation date for recent activity
    const sortedArchives = userArchives
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    stats.recentActivity = sortedArchives.map(archive => ({
        title: `${archive.name}'s Archive`,
        category: 'archive',
        createdAt: archive.createdAt
    }));
    
    return stats;
}

// Get all archives (for admin purposes)
async function getAllArchives() {
    return await loadArchives();
}

// Search archives
async function searchArchives(query) {
    const archives = await loadArchives();
    const lowercaseQuery = query.toLowerCase();
    
    return archives.filter(archive => {
        return archive.name.toLowerCase().includes(lowercaseQuery) ||
               (archive.channels && archive.channels.some(ch => 
                   ch.name.toLowerCase().includes(lowercaseQuery)
               ));
    });
}

// Get archive by channel ID
async function getArchiveByChannelId(channelId) {
    const archives = await loadArchives();
    
    return archives.find(archive => {
        return archive.categoryId === channelId ||
               archive.forumChannelId === channelId ||
               archive.workingNotesChannelId === channelId ||
               (archive.channels && archive.channels.some(ch => ch.id === channelId));
    });
}

// Update archive channels (for when channels are modified)
async function updateArchiveChannels(archiveName, channels) {
    const archives = await loadArchives();
    const archiveIndex = archives.findIndex(a => a.name.toLowerCase() === archiveName.toLowerCase());
    
    if (archiveIndex !== -1) {
        archives[archiveIndex].channels = channels;
        archives[archiveIndex].lastModified = new Date();
        await saveArchives(archives);
        return archives[archiveIndex];
    }
    
    return null;
}

module.exports = {
    saveArchiveData,
    getArchiveData,
    deleteArchiveData,
    updateArchiveStatus,
    getArchiveStats,
    getAllArchives,
    searchArchives,
    getArchiveByChannelId,
    updateArchiveChannels
};