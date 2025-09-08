const fs = require('fs').promises;
const path = require('path');

/**
 * Handles logout operations for WhatsApp sessions
 * Deletes user-specific session folders from .wwebjs_auth
 */
class LogoutHandler {
    constructor() {
        this.authBasePath = path.join(process.cwd(), '.wwebjs_auth');
        this.cacheBasePath = path.join(process.cwd(), '.wwebjs_cache');
    }

    /**
     * Sanitizes client ID to match the session folder naming convention
     * @param {string} clientId - The client identifier (email or username)
     * @returns {string} - Sanitized client ID
     */
    sanitizeClientId(clientId) {
        try {
            if (!clientId || typeof clientId !== 'string') {
                return null;
            }

            let sanitized = String(clientId)
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_')
                .slice(0, 64);
            
            sanitized = sanitized.replace(/^_+|_+$/g, '');
            return sanitized || null;
        } catch (error) {
            console.error('Error sanitizing client ID:', error);
            return null;
        }
    }

    /**
     * Gets the session folder path for a specific user
     * @param {string} clientId - The client identifier
     * @returns {string} - Full path to the session folder
     */
    getSessionPath(clientId) {
        const sanitizedId = this.sanitizeClientId(clientId);
        if (!sanitizedId) {
            return null;
        }
        return path.join(this.authBasePath, `session-${sanitizedId}`);
    }

    /**
     * Checks if a session folder exists
     * @param {string} clientId - The client identifier
     * @returns {Promise<boolean>} - True if session folder exists
     */
    async sessionExists(clientId) {
        try {
            const sessionPath = this.getSessionPath(clientId);
            if (!sessionPath) {
                return false;
            }

            await fs.access(sessionPath, fs.constants.F_OK);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Cleans up lock files and browser artifacts from a session folder
     * @param {string} sessionPath - Path to the session folder
     * @returns {Promise<{success: boolean, cleanedFiles: string[]}>}
     */
    async cleanupLockFiles(sessionPath) {
        const cleanedFiles = [];
        
        try {
            if (!await this.sessionExists(sessionPath)) {
                return { success: true, cleanedFiles: [] };
            }

            const lockFiles = [
                'SingletonLock',
                'SingletonSocket',
                'SingletonCookie',
                'DevToolsActivePort',
                'chrome_shutdown_ms.txt',
                'lockfile'
            ];

            for (const lockFile of lockFiles) {
                const lockFilePath = path.join(sessionPath, lockFile);
                try {
                    await fs.unlink(lockFilePath);
                    cleanedFiles.push(lockFile);
                    console.log(`Cleaned up lock file: ${lockFile}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Could not clean up lock file ${lockFile}:`, error.message);
                    }
                }
            }

            // Also clean up any Chrome crash dumps
            try {
                const crashDumpsDir = path.join(sessionPath, 'Crashpad');
                if (await fs.access(crashDumpsDir, fs.constants.F_OK).then(() => true).catch(() => false)) {
                    await fs.rm(crashDumpsDir, { recursive: true, force: true });
                    cleanedFiles.push('Crashpad');
                    console.log('Cleaned up crash dumps directory');
                }
            } catch (error) {
                console.warn('Could not clean up crash dumps:', error.message);
            }

            return { success: true, cleanedFiles };

        } catch (error) {
            console.error('Error cleaning up lock files:', error);
            return { success: false, cleanedFiles };
        }
    }

    /**
     * Deletes a user's session folder and all its contents
     * @param {string} clientId - The client identifier
     * @returns {Promise<{success: boolean, message: string, deletedPath?: string, cleanedFiles?: string[]}>}
     */
    async deleteUserSession(clientId) {
        try {
            const sessionPath = this.getSessionPath(clientId);
            
            if (!sessionPath) {
                return {
                    success: false,
                    message: 'Invalid client ID provided'
                };
            }

            // Check if session folder exists
            const exists = await this.sessionExists(clientId);
            if (!exists) {
                return {
                    success: true,
                    message: 'Session folder does not exist (already cleaned up)',
                    deletedPath: sessionPath
                };
            }

            // First, clean up lock files to prevent browser startup issues
            const lockCleanup = await this.cleanupLockFiles(sessionPath);
            console.log(`Lock file cleanup result:`, lockCleanup);

            // Delete the entire session folder recursively
            await fs.rm(sessionPath, { recursive: true, force: true });
            
            console.log(`Successfully deleted session folder for user: ${clientId}`);
            console.log(`Deleted path: ${sessionPath}`);

            return {
                success: true,
                message: 'Session folder deleted successfully',
                deletedPath: sessionPath,
                cleanedFiles: lockCleanup.cleanedFiles
            };

        } catch (error) {
            console.error(`Error deleting session folder for user ${clientId}:`, error);
            
            return {
                success: false,
                message: `Failed to delete session folder: ${error.message}`
            };
        }
    }

    /**
     * Cleans up orphaned session folders (folders without active sessions)
     * @returns {Promise<{success: boolean, message: string, cleanedFolders: string[]}>}
     */
    async cleanupOrphanedSessions() {
        try {
            // Check if .wwebjs_auth directory exists
            await fs.access(this.authBasePath, fs.constants.F_OK);
            
            const folders = await fs.readdir(this.authBasePath);
            const sessionFolders = folders.filter(folder => folder.startsWith('session-'));
            
            const cleanedFolders = [];
            
            for (const folder of sessionFolders) {
                const folderPath = path.join(this.authBasePath, folder);
                
                try {
                    // Check if folder is empty or contains only lock files
                    const contents = await fs.readdir(folderPath);
                    const hasActiveFiles = contents.some(file => 
                        !file.includes('Lock') && 
                        !file.includes('lock') && 
                        !file.includes('Singleton')
                    );
                    
                    if (!hasActiveFiles) {
                        await fs.rm(folderPath, { recursive: true, force: true });
                        cleanedFolders.push(folder);
                        console.log(`Cleaned up orphaned session folder: ${folder}`);
                    }
                } catch (error) {
                    console.warn(`Could not clean up folder ${folder}:`, error.message);
                }
            }

            return {
                success: true,
                message: `Cleaned up ${cleanedFolders.length} orphaned session folders`,
                cleanedFolders
            };

        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    success: true,
                    message: 'No .wwebjs_auth directory found',
                    cleanedFolders: []
                };
            }
            
            console.error('Error cleaning up orphaned sessions:', error);
            return {
                success: false,
                message: `Failed to clean up orphaned sessions: ${error.message}`,
                cleanedFolders: []
            };
        }
    }

    /**
     * Gets information about all session folders
     * @returns {Promise<{success: boolean, sessions: Array, message?: string}>}
     */
    async getSessionInfo() {
        try {
            await fs.access(this.authBasePath, fs.constants.F_OK);
            
            const folders = await fs.readdir(this.authBasePath);
            const sessionFolders = folders.filter(folder => folder.startsWith('session-'));
            
            const sessions = [];
            
            for (const folder of sessionFolders) {
                const folderPath = path.join(this.authBasePath, folder);
                const clientId = folder.replace('session-', '');
                
                try {
                    const stats = await fs.stat(folderPath);
                    const contents = await fs.readdir(folderPath);
                    
                    sessions.push({
                        clientId,
                        folderName: folder,
                        path: folderPath,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        size: await this.getFolderSize(folderPath),
                        fileCount: contents.length
                    });
                } catch (error) {
                    console.warn(`Could not get info for folder ${folder}:`, error.message);
                }
            }

            return {
                success: true,
                sessions,
                message: `Found ${sessions.length} session folders`
            };

        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    success: true,
                    sessions: [],
                    message: 'No .wwebjs_auth directory found'
                };
            }
            
            console.error('Error getting session info:', error);
            return {
                success: false,
                sessions: [],
                message: `Failed to get session info: ${error.message}`
            };
        }
    }

    /**
     * Calculates the size of a folder recursively
     * @param {string} folderPath - Path to the folder
     * @returns {Promise<number>} - Size in bytes
     */
    async getFolderSize(folderPath) {
        try {
            const contents = await fs.readdir(folderPath);
            let totalSize = 0;
            
            for (const item of contents) {
                const itemPath = path.join(folderPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    totalSize += await this.getFolderSize(itemPath);
                } else {
                    totalSize += stats.size;
                }
            }
            
            return totalSize;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Cleans up lock files for a specific user session
     * @param {string} clientId - The client identifier
     * @returns {Promise<{success: boolean, message: string, cleanedFiles?: string[]}>}
     */
    async cleanupUserLockFiles(clientId) {
        try {
            const sessionPath = this.getSessionPath(clientId);
            
            if (!sessionPath) {
                return {
                    success: false,
                    message: 'Invalid client ID provided'
                };
            }

            const lockCleanup = await this.cleanupLockFiles(sessionPath);
            
            if (lockCleanup.success) {
                return {
                    success: true,
                    message: `Cleaned up ${lockCleanup.cleanedFiles.length} lock files`,
                    cleanedFiles: lockCleanup.cleanedFiles
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to clean up lock files'
                };
            }

        } catch (error) {
            console.error(`Error cleaning up lock files for user ${clientId}:`, error);
            return {
                success: false,
                message: `Failed to clean up lock files: ${error.message}`
            };
        }
    }

    /**
     * Formats bytes to human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Handles cleanup when browser/tab is closed without proper logout
     * This method should be called when a browser connection is lost
     * @param {string} clientId - The client identifier
     * @returns {Promise<{success: boolean, message: string, deletedPath?: string}>}
     */
    async handleBrowserClose(clientId) {
        try {
            console.log(`Handling browser close cleanup for user: ${clientId}`);
            
            const sessionPath = this.getSessionPath(clientId);
            
            if (!sessionPath) {
                return {
                    success: false,
                    message: 'Invalid client ID provided'
                };
            }

            // Check if session folder exists
            const exists = await this.sessionExists(clientId);
            if (!exists) {
                return {
                    success: true,
                    message: 'Session folder does not exist (already cleaned up)',
                    deletedPath: sessionPath
                };
            }

            // Clean up lock files first
            const lockCleanup = await this.cleanupLockFiles(sessionPath);
            console.log(`Lock file cleanup result for browser close:`, lockCleanup);

            // Delete the entire session folder recursively
            await fs.rm(sessionPath, { recursive: true, force: true });
            
            console.log(`Successfully cleaned up session folder after browser close for user: ${clientId}`);
            console.log(`Deleted path: ${sessionPath}`);

            return {
                success: true,
                message: 'Session folder cleaned up after browser close',
                deletedPath: sessionPath,
                cleanedFiles: lockCleanup.cleanedFiles
            };

        } catch (error) {
            console.error(`Error cleaning up session folder after browser close for user ${clientId}:`, error);
            
            return {
                success: false,
                message: `Failed to clean up session folder after browser close: ${error.message}`
            };
        }
    }

    /**
     * Monitors for orphaned sessions and cleans them up
     * This method can be called periodically to clean up sessions from users who closed their browser
     * @returns {Promise<{success: boolean, message: string, cleanedSessions: string[]}>}
     */
    async cleanupOrphanedSessionsFromBrowserClose() {
        try {
            console.log('Checking for orphaned sessions from browser close...');
            
            // Check if .wwebjs_auth directory exists
            await fs.access(this.authBasePath, fs.constants.F_OK);
            
            const folders = await fs.readdir(this.authBasePath);
            const sessionFolders = folders.filter(folder => folder.startsWith('session-'));
            
            const cleanedSessions = [];
            
            for (const folder of sessionFolders) {
                const folderPath = path.join(this.authBasePath, folder);
                const clientId = folder.replace('session-', '');
                
                try {
                    // Check if folder contains only lock files (indicating browser was closed)
                    const contents = await fs.readdir(folderPath);
                    const lockFiles = contents.filter(file => 
                        file.includes('Lock') || 
                        file.includes('lock') || 
                        file.includes('Singleton') ||
                        file.includes('DevToolsActivePort') ||
                        file.includes('chrome_shutdown_ms.txt')
                    );
                    
                    // If folder contains only lock files, it means browser was closed without proper logout
                    if (lockFiles.length > 0 && lockFiles.length === contents.length) {
                        console.log(`Found orphaned session from browser close: ${folder}`);
                        
                        // Clean up the session
                        const result = await this.handleBrowserClose(clientId);
                        if (result.success) {
                            cleanedSessions.push(clientId);
                        }
                    }
                } catch (error) {
                    console.warn(`Could not check folder ${folder}:`, error.message);
                }
            }

            return {
                success: true,
                message: `Cleaned up ${cleanedSessions.length} orphaned sessions from browser close`,
                cleanedSessions
            };

        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    success: true,
                    message: 'No .wwebjs_auth directory found',
                    cleanedSessions: []
                };
            }
            
            console.error('Error cleaning up orphaned sessions from browser close:', error);
            return {
                success: false,
                message: `Failed to clean up orphaned sessions from browser close: ${error.message}`,
                cleanedSessions: []
            };
        }
    }
}

// Create singleton instance
const logoutHandler = new LogoutHandler();

module.exports = {
    LogoutHandler,
    logoutHandler
};
