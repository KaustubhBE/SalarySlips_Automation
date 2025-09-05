#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test the cleanup function
async function testCleanup() {
    console.log('Testing session directory cleanup (startup only)...');
    
    // Create test directories and files
    const testDirs = [
        path.join(process.cwd(), '.wwebjs_auth'),
        path.join(process.cwd(), '.wwebjs_cache')
    ];
    
    // Create test directories with some files
    for (const dir of testDirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created test directory: ${dir}`);
            
            // Create some test files
            const testFiles = ['test1.txt', 'test2.txt', 'SingletonLock'];
            for (const file of testFiles) {
                fs.writeFileSync(path.join(dir, file), 'test content');
                console.log(`Created test file: ${file}`);
            }
        }
    }
    
    // Create HTML files in .wwebjs_cache for testing
    const cacheDir = path.join(process.cwd(), '.wwebjs_cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`Created test cache directory: ${cacheDir}`);
    }
    
    // Create some HTML files
    const htmlFiles = ['test1.html', 'test2.html', 'cache.html'];
    for (const file of htmlFiles) {
        fs.writeFileSync(path.join(cacheDir, file), '<html>test content</html>');
        console.log(`Created HTML file: ${file}`);
    }
    
    console.log('\nTest directories created. Now testing cleanup...');
    
    // Test cleanup function (simulating startup cleanup)
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
        for (const dir of testDirs) {
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
        
        // Verify cleanup
        console.log('\nVerifying cleanup...');
        for (const dir of testDirs) {
            if (fs.existsSync(dir)) {
                console.log(`❌ Directory still exists: ${dir}`);
            } else {
                console.log(`✅ Directory successfully removed: ${dir}`);
            }
        }
        
        // Verify HTML files cleanup
        if (fs.existsSync(cacheDir)) {
            const remainingFiles = fs.readdirSync(cacheDir).filter(f => f.endsWith('.html'));
            if (remainingFiles.length > 0) {
                console.log(`❌ HTML files still exist: ${remainingFiles.join(', ')}`);
            } else {
                console.log(`✅ All HTML files successfully removed from ${cacheDir}`);
            }
        } else {
            console.log(`✅ Cache directory completely removed`);
        }
        
    } catch (error) {
        console.error('Error during cleanup test:', error);
    }
}

// Run the test
testCleanup().then(() => {
    console.log('\nCleanup test completed');
    console.log('Note: Cleanup now only happens on server startup/reload, not during runtime');
    process.exit(0);
}).catch(error => {
    console.error('Cleanup test failed:', error);
    process.exit(1);
});
