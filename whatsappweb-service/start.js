const { WhatsAppServer } = require('./WhatsWeb.js');
const fs = require('fs');
const path = require('path');

// Function to clean up session directories and processes
async function cleanupSessionDirectories() {
    try {
        console.log('Cleaning up session directories and processes on startup...');
        
        // Kill any existing Chrome/Chromium processes first
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const cleanupCommands = [
            'pkill -9 -f "chrome.*whatsapp"',
            'pkill -9 -f "chromium.*whatsapp"',
            'pkill -9 -f "chrome.*wwebjs"',
            'pkill -9 -f "chromium.*wwebjs"',
            'pkill -9 -f "chrome.*headless"',
            'pkill -9 -f "chromium.*headless"'
        ];
        
        for (const cmd of cleanupCommands) {
            try {
                await execAsync(cmd);
                console.log(`Executed cleanup command: ${cmd}`);
            } catch (error) {
                // Ignore errors - processes might not exist
                console.log(`Cleanup command completed: ${cmd}`);
            }
        }
        
        // Wait a moment for processes to terminate
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Clean up session directories
        const sessionDirs = [
            path.join(process.cwd(), '.wwebjs_auth'),
            path.join(process.cwd(), '.wwebjs_cache')
        ];
        
        for (const dir of sessionDirs) {
            if (fs.existsSync(dir)) {
                console.log(`Removing directory: ${dir}`);
                fs.rmSync(dir, { recursive: true, force: true });
                console.log(`Successfully removed: ${dir}`);
            } else {
                console.log(`Directory does not exist: ${dir}`);
            }
        }
        
        // Additional cleanup for HTML files in .wwebjs_cache (if it exists)
        const cacheDir = path.join(process.cwd(), '.wwebjs_cache');
        if (fs.existsSync(cacheDir)) {
            console.log(`Cleaning up HTML files in: ${cacheDir}`);
            try {
                const files = fs.readdirSync(cacheDir);
                for (const file of files) {
                    if (file.endsWith('.html')) {
                        const filePath = path.join(cacheDir, file);
                        fs.unlinkSync(filePath);
                        console.log(`Removed HTML file: ${file}`);
                    }
                }
            } catch (error) {
                console.log(`No HTML files to clean in ${cacheDir}`);
            }
        }
        
        console.log('Session directories and processes cleanup completed');
    } catch (error) {
        console.error('Error cleaning up session directories:', error);
        // Don't fail startup if cleanup fails
    }
}

// Global server variable for graceful shutdown
let server = null;

// Clean up session directories before starting server
async function startServer() {
    await cleanupSessionDirectories();
    
    // Create server instance binding to all interfaces for domain access
    server = new WhatsAppServer(8092, '0.0.0.0');
    
    server.start().catch(console.error);
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down WhatsApp server...');
    if (server) {
        await server.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down WhatsApp server...');
    if (server) {
        await server.stop();
    }
    process.exit(0);
});
