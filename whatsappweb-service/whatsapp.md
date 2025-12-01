# Session Manager

const axios = require('axios');
const { WhatsAppService } = require('./service');

class WhatsAppSessionManager {
    constructor() {
        this.sessions = new Map(); // clientId -> session info
        this.serviceInstances = new Map(); // clientId -> WhatsAppService instance
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
        this.creationCooldown = 10 * 1000; // 10 seconds cooldown between session creations
        this.lastCreationTimes = new Map(); // clientId -> last creation time
        this.logThrottle = new Map(); // clientId -> last log time
        this.creationLocks = new Map(); // clientId -> creation promise
        this.globalLock = false; // Global lock for critical operations
        
        // Start cleanup timer
        this.startCleanupTimer();
        
        console.log('WhatsApp Session Manager initialized');
    }

    async getServiceForClient(clientId) {
        const sanitizedClientId = this.sanitizeClientId(clientId);
        
        // Check if we have an active session
        if (this.sessions.has(sanitizedClientId)) {
            const session = this.sessions.get(sanitizedClientId);
            
            // Check if session is still valid
            if (this.isSessionValid(session)) {
                session.lastAccessed = Date.now();
                return this.serviceInstances.get(sanitizedClientId);
            } else {
                this.cleanupSession(sanitizedClientId);
            }
        }
        
        // Check if creation is already in progress
        if (this.creationLocks.has(sanitizedClientId)) {
            console.log(`Session creation already in progress for ${sanitizedClientId}, waiting...`);
            return this.creationLocks.get(sanitizedClientId);
        }
        
        // Check creation cooldown to prevent rapid session creation
        if (this.isInCreationCooldown(sanitizedClientId)) {
            // Return existing service if available, even if expired
            const existingService = this.serviceInstances.get(sanitizedClientId);
            if (existingService) {
                return existingService;
            }
        }
        
        // Create new session with locking
        return this.createNewSessionWithLock(sanitizedClientId);
    }

    async createNewSessionWithLock(clientId) {
        // Create a promise for the session creation
        const creationPromise = this._createNewSession(clientId);
        
        // Store the promise in the locks map
        this.creationLocks.set(clientId, creationPromise);
        
        try {
            const service = await creationPromise;
            return service;
        } finally {
            // Always clean up the lock
            this.creationLocks.delete(clientId);
        }
    }

    async _createNewSession(clientId) {
        try {
            // Update creation time for cooldown
            this.lastCreationTimes.set(clientId, Date.now());
            
            // Create new service instance with timeout protection
            const service = new WhatsAppService(clientId);
            
            // Store session info
            const session = {
                clientId: clientId,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                isActive: true,
                service: service
            };
            
            this.sessions.set(clientId, session);
            this.serviceInstances.set(clientId, service);
            
            // Set up session event listeners
            this.setupSessionListeners(clientId, service);
            
            console.log(`New session created for clientId: ${clientId}`);
            return service;
            
        } catch (error) {
            console.error(`Error creating session for clientId: ${clientId}:`, error);
            // Clean up on error
            this.cleanupSession(clientId);
            throw error;
        }
    }

    createNewSession(clientId) {
        // Legacy method for backward compatibility
        return this._createNewSession(clientId);
    }

    setupSessionListeners(clientId, service) {
        // Listen for service state changes
        service.authClient.on('ready', () => {
            console.log(`Session ${clientId} is ready`);
            const session = this.sessions.get(clientId);
            if (session) {
                session.isActive = true;
                session.lastAccessed = Date.now();
            }
        });

        service.authClient.on('disconnected', () => {
            console.log(`Session ${clientId} disconnected`);
            const session = this.sessions.get(clientId);
            if (session) {
                session.isActive = false;
            }
        });

        service.authClient.on('qr', (qr) => {
            console.log(`QR code generated for session ${clientId}`);
            const session = this.sessions.get(clientId);
            if (session) {
                session.lastAccessed = Date.now();
            }
        });

        service.authClient.on('authenticated', () => {
            console.log(`Session ${clientId} authenticated`);
            const session = this.sessions.get(clientId);
            if (session) {
                session.isActive = true;
                session.lastAccessed = Date.now();
                // Extend session timeout for authenticated sessions
                session.authenticatedAt = Date.now();
            }
        });
    }

    isSessionValid(session) {
        if (!session || !session.isActive) {
            return false;
        }
        
        const now = Date.now();
        const timeSinceLastAccess = now - session.lastAccessed;
        const timeSinceCreation = now - session.createdAt;
        
        // Use longer timeout for authenticated sessions
        // For authenticated sessions, check against authentication time (24 hours)
        // For non-authenticated sessions, check against last access time (30 min)
        if (session.authenticatedAt) {
            const timeSinceAuthentication = now - session.authenticatedAt;
            const authenticationTimeout = 24 * 60 * 60 * 1000; // 24 hours
            const isNotTooRecent = timeSinceCreation > 5000; // 5 seconds minimum age
            
            return timeSinceAuthentication < authenticationTimeout && isNotTooRecent;
        }
        
        // For non-authenticated sessions, use the default timeout based on last access
        const effectiveTimeout = this.sessionTimeout; // 30 min for non-authenticated
        const isWithinAccessTimeout = timeSinceLastAccess < effectiveTimeout;
        const isNotTooRecent = timeSinceCreation > 5000; // 5 seconds minimum age
        
        return isWithinAccessTimeout && isNotTooRecent;
    }

    cleanupSession(clientId) {
        try {
            const service = this.serviceInstances.get(clientId);
            if (service) {
                // Disconnect the service
                service.disconnect().catch(error => {
                    console.error(`Error disconnecting service for ${clientId}:`, error);
                });
            }
            
            this.sessions.delete(clientId);
            this.serviceInstances.delete(clientId);
            
            console.log(`Session cleaned up for clientId: ${clientId}`);
        } catch (error) {
            console.error(`Error cleaning up session for ${clientId}:`, error);
        }
    }

    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupInterval);
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        const expiredSessions = [];
        
        for (const [clientId, session] of this.sessions.entries()) {
            if (!this.isSessionValid(session)) {
                expiredSessions.push(clientId);
            }
        }
        
        expiredSessions.forEach(clientId => {
            console.log(`Cleaning up expired session: ${clientId}`);
            this.cleanupSession(clientId);
        });
        
        if (expiredSessions.length > 0) {
            console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }

    sanitizeClientId(clientId) {
        try {
            let sanitized = String(clientId || 'default')
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_')
                .slice(0, 64);
            
            sanitized = sanitized.replace(/^_+|_+$/g, '');
            return sanitized || 'default';
        } catch (_) {
            return 'default';
        }
    }

    getSessionStatus(clientId) {
        const sanitizedClientId = this.sanitizeClientId(clientId);
        const session = this.sessions.get(sanitizedClientId);
        
        if (!session) {
            return { exists: false, active: false };
        }
        
        return {
            exists: true,
            active: this.isSessionValid(session),
            createdAt: session.createdAt,
            lastAccessed: session.lastAccessed,
            clientId: sanitizedClientId
        };
    }

    getAllSessions() {
        const sessions = [];
        for (const [clientId, session] of this.sessions.entries()) {
            sessions.push({
                clientId,
                isActive: this.isSessionValid(session),
                createdAt: session.createdAt,
                lastAccessed: session.lastAccessed
            });
        }
        return sessions;
    }

    // Method to force cleanup of a specific session
    forceCleanupSession(clientId) {
        const sanitizedClientId = this.sanitizeClientId(clientId);
        console.log(`Force cleaning up session: ${sanitizedClientId}`);
        this.cleanupSession(sanitizedClientId);
    }

    // Method to get session count
    getSessionCount() {
        return this.sessions.size;
    }

    // Method to get session statistics
    getSessionStats() {
        const now = Date.now();
        const stats = {
            totalSessions: this.sessions.size,
            activeSessions: 0,
            expiredSessions: 0,
            recentCreations: 0,
            oldestSession: null,
            newestSession: null
        };

        let oldestTime = now;
        let newestTime = 0;

        for (const [clientId, session] of this.sessions.entries()) {
            if (this.isSessionValid(session)) {
                stats.activeSessions++;
            } else {
                stats.expiredSessions++;
            }

            // Check for recent creations (last 5 minutes)
            if (now - session.createdAt < 5 * 60 * 1000) {
                stats.recentCreations++;
            }

            // Track oldest and newest
            if (session.createdAt < oldestTime) {
                oldestTime = session.createdAt;
                stats.oldestSession = clientId;
            }
            if (session.createdAt > newestTime) {
                newestTime = session.createdAt;
                stats.newestSession = clientId;
            }
        }

        return stats;
    }

    // Helper method to check if we should log (throttle logging)
    shouldLog(clientId, logType) {
        const now = Date.now();
        const logKey = `${clientId}_${logType}`;
        const lastLogTime = this.logThrottle.get(logKey) || 0;
        const logInterval = 30 * 1000; // 30 seconds between same type logs
        
        if (now - lastLogTime > logInterval) {
            this.logThrottle.set(logKey, now);
            return true;
        }
        return false;
    }

    // Helper method to check creation cooldown
    isInCreationCooldown(clientId) {
        const now = Date.now();
        const lastCreationTime = this.lastCreationTimes.get(clientId) || 0;
        return (now - lastCreationTime) < this.creationCooldown;
    }

    // Method to check actual WhatsApp client status
    async checkWhatsAppClientStatus(clientId) {
        const sanitizedClientId = this.sanitizeClientId(clientId);
        const service = this.serviceInstances.get(sanitizedClientId);
        
        if (!service) {
            return { exists: false, ready: false, reason: 'No service instance' };
        }
        
        try {
            const status = await service.getCurrentStatus();
            return {
                exists: true,
                ready: status.isReady || false,
                authenticated: status.authenticated || false,
                hasQR: status.hasQR || false,
                userInfo: status.userInfo || null,
                status: status
            };
        } catch (error) {
            console.error(`Error checking WhatsApp client status for ${sanitizedClientId}:`, error);
            return { exists: true, ready: false, reason: error.message };
        }
    }
}

// Create singleton instance
const sessionManager = new WhatsAppSessionManager();

module.exports = { WhatsAppSessionManager, sessionManager };

# Auth 

const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class WhatsAppAuth extends EventEmitter {
    constructor(clientId = 'default') {
        super();
        this.clientId = String(clientId);
        this.isReady = false;
        this.isInitialized = false;
        this.currentQR = null;
        this.client = null;
        this.sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${this.clientId}`);
        this._initializing = false;
        this._initializationPromise = null;
        
        console.log(`WhatsAppAuth initialized for clientId: ${this.clientId}`);
        console.log(`Session path: ${this.sessionPath}`);
    }

    // Removed cleanupCorruptedSession - cleanup only happens on server startup now

    // Removed killChromeProcesses - process cleanup only happens on server startup now

    async initialize() {
        if (this.isInitialized) {
            console.log(`Client ${this.clientId} already initialized`);
            return;
        }

        // Prevent concurrent initialization
        if (this._initializing) {
            console.log(`Client ${this.clientId} is already initializing, waiting...`);
            return this._initializationPromise;
        }

        this._initializing = true;
        this._initializationPromise = this._performInitialization();
        
        try {
            return await this._initializationPromise;
        } finally {
            this._initializing = false;
            this._initializationPromise = null;
        }
    }

    async _performInitialization() {
        try {
            console.log(`Initializing WhatsApp client for clientId: ${this.clientId}`);
            
            this.client = new Client({
                authStrategy: new LocalAuth({ clientId: this.clientId }),
                puppeteer: {
                    headless: true,
                    userDataDir: this.sessionPath, // Explicit user data directory
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--memory-pressure-off',
                        '--max_old_space_size=4096',
                        '--hide-scrollbars',
                        '--mute-audio',
                        '--no-first-run',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-features=TranslateUI',
                        '--disable-ipc-flooding-protection',
                        '--no-default-browser-check',
                        '--disable-default-apps',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-sync',
                        '--disable-translate',
                        '--disable-background-networking',
                        '--disable-component-extensions-with-background-pages',
                        '--disable-client-side-phishing-detection',
                        '--disable-hang-monitor',
                        '--disable-prompt-on-repost',
                        '--disable-domain-reliability',
                        '--disable-features=VizDisplayCompositor'
                    ],
                    executablePath: '/usr/bin/chromium-browser',
                    ignoreDefaultArgs: ['--disable-extensions'],
                    timeout: 0, // No timeout
                    protocolTimeout: 0 // No protocol timeout
                }
            });

            this.setupEventListeners();
            
            console.log(`Starting client initialization for ${this.clientId}...`);
            
            // Simple initialization without retry logic
            try {
                await this.client.initialize();
                console.log(`WhatsApp client initialized successfully for clientId: ${this.clientId}`);
                this.isInitialized = true;
            } catch (initError) {
                console.error(`Error during client initialization: ${initError.message}`);
                throw initError;
            }
            
            // Check if we're already ready after initialization
            if (this.isReady) {
                console.log(`Client ${this.clientId} is ready immediately after initialization`);
            } else if (this.currentQR) {
                console.log(`Client ${this.clientId} has QR code available after initialization`);
            } else {
                console.log(`Client ${this.clientId} is still initializing, waiting for QR or ready event`);
            }
            
        } catch (error) {
            console.error(`Error initializing WhatsApp client for ${this.clientId}:`, error);
            this.isInitialized = false;
            throw error;
        }
    }

    setupEventListeners() {
        if (!this.client) return;

        this.client.on('qr', (qr) => {
            console.log(`QR Code generated for clientId: ${this.clientId}`);
            this.currentQR = qr;
            // Clear cached connection status to force refresh
            this._cachedConnectionStatus = null;
            this.emit('qr', qr);
        });

        this.client.on('ready', async () => {
            // Only log once when client becomes ready
            if (!this._readyLogged) {
                console.log(`WhatsApp Client ready for clientId: ${this.clientId}`);
                this._readyLogged = true;
            }
            
            // Perform additional readiness checks
            try {
                await this.validateClientReadiness();
                this.isReady = true;
                this.currentQR = null;
                // Clear cached connection status to force refresh
                this._cachedConnectionStatus = null;
                console.log(`Client ${this.clientId} fully validated and ready`);
                this.emit('ready');
            } catch (validationError) {
                console.error(`Client readiness validation failed for ${this.clientId}:`, validationError);
                this.isReady = false;
                // Don't emit ready event if validation fails
            }
        });

        this.client.on('authenticated', async () => {
            const authStartTime = Date.now();
            console.log(`[TIMING] WhatsApp Client authenticated for clientId: ${this.clientId} at ${new Date().toISOString()}`);
            
            // Give WhatsApp Web a moment to fully load before marking as ready
            console.log(`[TIMING] Waiting 1 second for WhatsApp Web to load...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Wait for WhatsApp Web Store objects to be available
            console.log(`[TIMING] Waiting for WhatsApp Web Store objects to be available...`);
            const storeWaitStart = Date.now();
            
            try {
                const page = this.client.pupPage;
                if (page) {
                    // Wait for Store objects with timeout
                    let storeReady = false;
                    const maxWait = 60000; // 60 seconds max
                    const startTime = Date.now();
                    
                    while (Date.now() - startTime < maxWait && !storeReady) {
                        try {
                            const storeStatus = await page.evaluate(() => {
                                const storeExists = !!window.Store;
                                const msgExists = !!(window.Store && window.Store.Msg);
                                const chatExists = !!(window.Store && window.Store.Chat);
                                
                                // Test if the actual functions are available and working
                                let getContactWorks = false;
                                let getChatWorks = false;
                                
                                try {
                                    if (window.Store && window.Store.Contact) {
                                        getContactWorks = typeof window.Store.Contact.get === 'function';
                                    }
                                } catch (e) {
                                    getContactWorks = false;
                                }
                                
                                try {
                                    if (window.Store && window.Store.Chat) {
                                        getChatWorks = typeof window.Store.Chat.get === 'function';
                                    }
                                } catch (e) {
                                    getChatWorks = false;
                                }
                                
                                return {
                                    storeExists,
                                    msgExists,
                                    chatExists,
                                    getContactWorks,
                                    getChatWorks,
                                    allLoaded: storeExists && msgExists && chatExists && getContactWorks && getChatWorks
                                };
                            });
                            
                            if (storeStatus.allLoaded) {
                                storeReady = true;
                                console.log(`[TIMING] ✅ WhatsApp Web Store objects are now available`);
                            } else {
                                const elapsed = Date.now() - startTime;
                                console.log(`[TIMING] Store objects not ready yet (${elapsed}ms): Store=${storeStatus.storeExists}, Msg=${storeStatus.msgExists}, Chat=${storeStatus.chatExists}, getContact=${storeStatus.getContactWorks}, getChat=${storeStatus.getChatWorks}`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        } catch (error) {
                            console.warn(`[TIMING] Error checking Store objects: ${error.message}`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                    
                    if (!storeReady) {
                        console.warn(`[TIMING] ⚠️ Store objects not available after ${maxWait}ms, proceeding anyway`);
                    }
                } else {
                    console.warn(`[TIMING] Page is null, waiting for page to be available...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                console.warn(`[TIMING] Page validation failed: ${error.message}`);
            }
            
            const storeWaitEnd = Date.now();
            console.log(`[TIMING] Store object wait completed in ${storeWaitEnd - storeWaitStart}ms`);
            
            // Try to validate readiness, but don't fail if it doesn't work
            try {
                console.log(`[TIMING] Starting client readiness validation...`);
                const validationStart = Date.now();
                await this.validateClientReadiness();
                const validationEnd = Date.now();
                console.log(`[TIMING] Client ${this.clientId} validated after authentication in ${validationEnd - validationStart}ms`);
            } catch (validationError) {
                console.warn(`[TIMING] Validation failed after authentication, but continuing: ${validationError.message}`);
            }
            
            this.isReady = true;
            this.currentQR = null;
            // Clear cached connection status to force refresh
            this._cachedConnectionStatus = null;
            const totalAuthTime = Date.now() - authStartTime;
            console.log(`[TIMING] ✅ WhatsApp Client is now ready for clientId: ${this.clientId} - Total authentication time: ${totalAuthTime}ms (${Math.round(totalAuthTime/1000)}s)`);
            this.emit('ready');
        });
        this.client.on('auth_failure', (msg) => {
            console.error(`Authentication failed for clientId ${this.clientId}:`, msg);
            this.isReady = false;
            this.currentQR = null;
            // Clear cached connection status to force refresh
            this._cachedConnectionStatus = null;
            this.emit('disconnected', 'auth_failure');
            this.handleAuthFailure();
        });

        this.client.on('disconnected', (reason) => {
            console.log(`WhatsApp Client disconnected for ${this.clientId}:`, reason);
            this.isReady = false;
            this.currentQR = null;
            // Clear cached connection status to force refresh
            this._cachedConnectionStatus = null;
            this.emit('disconnected', reason);
            
            if (reason !== 'NAVIGATION') {
                console.log(`Attempting to recover session for ${this.clientId}...`);
                setTimeout(() => {
                    this.recoverSession();
                }, 5000);
            }
        });

        this.client.on('page_error', (error) => {
            console.error(`Page error for clientId ${this.clientId}:`, error);
        });

        // Add loading event listener
        this.client.on('loading_screen', (percent, message) => {
            console.log(`Loading screen for ${this.clientId}: ${percent}% - ${message}`);
        });
    }

    

    async waitForWhatsAppStore(maxWaitMs = null) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every 1 second
        const maxWait = maxWaitMs || Infinity; // Remove timeout by default
        
        console.log(`[TIMING] Starting Store object wait for clientId: ${this.clientId} at ${new Date().toISOString()}`);
        console.log(`[TIMING] Max wait time: ${maxWait === Infinity ? 'UNLIMITED' : maxWait + 'ms'}`);
        
        let checkCount = 0;
        
        while (Date.now() - startTime < maxWait) {
            checkCount++;
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            
            try {
                const page = this.client.pupPage;
                if (!page) {
                    console.log(`[TIMING] Check #${checkCount} (${elapsed}ms): Page not available for ${this.clientId}`);
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                    continue;
                }
                
                const storeStatus = await page.evaluate(() => {
                    const storeExists = !!window.Store;
                    const msgExists = !!(window.Store && window.Store.Msg);
                    const chatExists = !!(window.Store && window.Store.Chat);
                    
                    return {
                        storeExists,
                        msgExists,
                        chatExists,
                        allLoaded: storeExists && msgExists && chatExists,
                        storeType: typeof window.Store,
                        msgType: window.Store ? typeof window.Store.Msg : 'undefined',
                        chatType: window.Store ? typeof window.Store.Chat : 'undefined'
                    };
                });
                
                console.log(`[TIMING] Check #${checkCount} (${elapsed}ms): Store=${storeStatus.storeExists}(${storeStatus.storeType}), Msg=${storeStatus.msgExists}(${storeStatus.msgType}), Chat=${storeStatus.chatExists}(${storeStatus.chatType})`);
                
                if (storeStatus.allLoaded) {
                    const totalElapsed = Date.now() - startTime;
                    console.log(`[TIMING] ✅ Store objects available for ${this.clientId} after ${totalElapsed}ms (${Math.round(totalElapsed/1000)}s)`);
                    return true;
                }
                
                // Log progress every 30 seconds
                if (elapsed > 0 && elapsed % 30000 < 1000) {
                    console.log(`[TIMING] Still waiting... ${Math.round(elapsed/1000)}s elapsed, Store objects not ready yet`);
                }
                
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                
            } catch (error) {
                console.error(`[TIMING] Check #${checkCount} (${elapsed}ms): Error checking Store availability for ${this.clientId}: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        
        const totalElapsed = Date.now() - startTime;
        console.log(`[TIMING] ❌ Store objects not available after ${totalElapsed}ms (${Math.round(totalElapsed/1000)}s) for ${this.clientId}`);
        return false;
    }

    async validateClientReadiness() {
        if (!this.client) {
            throw new Error('Client not initialized');
        }

        // Simplified and fast validation - no Store object dependency
        try {
            const page = this.client.pupPage;
            if (!page) {
                console.log(`[TIMING] ⚠️ Page is null, but client reports as ready - proceeding anyway`);
                return true; // Don't fail if page is null, just proceed
            }

            // Quick validation - just check if page is responsive and has WhatsApp content
            const pageStatus = await page.evaluate(() => {
                return {
                    title: document.title,
                    hasWhatsAppContent: document.body && document.body.innerHTML.includes('WhatsApp'),
                    isResponsive: true // If we can evaluate this, page is responsive
                };
            });

            console.log(`[TIMING] Page validation: title="${pageStatus.title}", hasWhatsAppContent=${pageStatus.hasWhatsAppContent}`);
            
            // If page is responsive and has WhatsApp content, consider it ready
            if (pageStatus.isResponsive && pageStatus.hasWhatsAppContent) {
                console.log(`[TIMING] ✅ WhatsApp Web interface is ready for clientId: ${this.clientId}`);
                return true;
            }

            // Even if WhatsApp content check fails, if page is responsive, proceed
            console.log(`[TIMING] ⚠️ Page is responsive but WhatsApp content check failed, proceeding anyway`);
            return true;

        } catch (error) {
            console.error(`[TIMING] Client readiness validation failed for ${this.clientId}:`, error);
            // Don't throw error - just log and continue
            console.log(`[TIMING] ⚠️ Validation failed but continuing - error: ${error.message}`);
            return true; // Return true to continue anyway
        }
    }
 
    async handleAuthFailure() {
        try {
            console.log(`Handling auth failure for clientId: ${this.clientId}`);
            await this.cleanupCorruptedSession();
            await this.resetClient('auth failure');
        } catch (error) {
            console.error(`Error handling auth failure for ${this.clientId}:`, error);
        }
    }

    async resetClient(reason = 'unknown') {
        try {
            console.log(`Resetting WhatsApp client for ${this.clientId} due to: ${reason}`);
            
            if (this.client) {
                try {
                    await this.client.destroy();
                } catch (e) {
                    console.log(`Error destroying client: ${e.message}`);
                }
            }
            
            this.client = null;
            this.isReady = false;
            this.currentQR = null;
            this.isInitialized = false;
            
            // Clean up session directory
            await this.cleanupCorruptedSession();
            
        } catch (error) {
            console.error(`Error resetting client for ${this.clientId}:`, error);
        }
    }

    async forceNewSession() {
        try {
            console.log(`Forcing new session for clientId: ${this.clientId}`);
            await this.resetClient('force new session');
        } catch (error) {
            console.error(`Error forcing new session for ${this.clientId}:`, error);
        }
    }

    async recoverSession() {
        try {
            console.log(`Attempting session recovery for ${this.clientId}...`);
            
            if (!this.isInitialized) {
                await this.initialize();
            } else if (this.client && !this.isReady) {
                // Try to reinitialize the existing client
                try {
                    await this.client.initialize();
                    console.log(`Session recovery successful for ${this.clientId}`);
                } catch (error) {
                    console.log(`Session recovery failed for ${this.clientId}, resetting:`, error.message);
                    await this.resetClient('session recovery failed');
                }
            }
        } catch (error) {
            console.error(`Error during session recovery for ${this.clientId}:`, error);
            await this.resetClient('session recovery error');
        }
    }

    async triggerLogin(timeoutMs = null) { // No timeout - allow unlimited time
        try {
            console.log(`Triggering login for clientId: ${this.clientId}`);
            
            // If already ready and authenticated, return current status
            if (this.isReady) {
                try {
                    const userInfo = await this.getUserInfo();
                    if (userInfo) {
                        console.log(`User already authenticated for ${this.clientId}:`, userInfo.name);
                        return {
                            isReady: true,
                            qr: '',
                            authenticated: true,
                            userInfo: userInfo
                        };
                    }
                } catch (error) {
                    console.log(`Session validation failed for ${this.clientId}, proceeding with fresh login`);
                    this.isReady = false;
                }
            }
            
            // Initialize if not already done
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            // If QR is already available, return it immediately
            if (this.currentQR) {
                console.log(`QR already available for ${this.clientId}, returning it`);
                return {
                    isReady: false,
                    qr: this.currentQR,
                    authenticated: false
                };
            }
            
            // Wait for either QR or ready event
            return new Promise((resolve) => {
                let resolved = false;
                let timeout = null;
                
                // Only set timeout if timeoutMs is provided
                if (timeoutMs !== null) {
                    timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            console.log(`Login timeout reached for ${this.clientId}`);
                            resolve({
                                isReady: this.isReady,
                                qr: this.currentQR || '',
                                authenticated: this.isReady,
                                message: this.isReady ? 'Already authenticated' : 'Login timeout'
                            });
                        }
                    }, timeoutMs);
                }
                
                const onQR = (qr) => {
                    if (!resolved) {
                        resolved = true;
                        if (timeout) clearTimeout(timeout);
                        console.log(`QR received for ${this.clientId}`);
                        this.currentQR = qr;
                        resolve({
                            isReady: false,
                            qr: qr,
                            authenticated: false
                        });
                    }
                };
                
                const onReady = () => {
                    if (!resolved) {
                        resolved = true;
                        if (timeout) clearTimeout(timeout);
                        console.log(`Ready event received for ${this.clientId}`);
                        this.isReady = true;
                        this.currentQR = null;
                        resolve({
                            isReady: true,
                            qr: '',
                            authenticated: true,
                            message: 'Authentication successful'
                        });
                    }
                };
                
                const onAuthenticated = () => {
                    if (!resolved) {
                        resolved = true;
                        if (timeout) clearTimeout(timeout);
                        console.log(`Authenticated event received for ${this.clientId}`);
                        this.isReady = true;
                        this.currentQR = null;
                        resolve({
                            isReady: true,
                            qr: '',
                            authenticated: true,
                            message: 'Authentication successful'
                        });
                    }
                };
                
                // Check if we already have a QR or are ready before setting up listeners
                if (this.currentQR) {
                    resolved = true;
                    if (timeout) clearTimeout(timeout);
                    resolve({
                        isReady: false,
                        qr: this.currentQR,
                        authenticated: false
                    });
                } else if (this.isReady) {
                    resolved = true;
                    if (timeout) clearTimeout(timeout);
                    resolve({
                        isReady: true,
                        qr: '',
                        authenticated: true,
                        message: 'Already authenticated'
                    });
                } else {
                    // Set up event listeners
                    this.client.once('qr', onQR);
                    this.client.once('ready', onReady);
                    this.client.once('authenticated', onAuthenticated);
                }
            });
            
        } catch (error) {
            console.error(`Error triggering login for ${this.clientId}:`, error);
            return {
                isReady: false,
                qr: '',
                authenticated: false,
                error: error.message
            };
        }
    }

    async waitForReady(timeoutMs = null) {
        try {
            if (this.isReady) {
                return true;
            }
            
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            return new Promise((resolve, reject) => {
                let timeout = null;
                
                // Only set timeout if timeoutMs is provided
                if (timeoutMs !== null) {
                    timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for WhatsApp client to be ready'));
                    }, timeoutMs);
                }
                
                if (this.isReady) {
                    if (timeout) clearTimeout(timeout);
                    resolve(true);
                } else {
                    const onReady = () => {
                        if (timeout) clearTimeout(timeout);
                        this.isReady = true;
                        this.currentQR = null;
                        resolve(true);
                    };
                    
                    this.client.once('ready', onReady);
                }
            });
        } catch (error) {
            console.error(`Error waiting for ready state for ${this.clientId}:`, error);
            throw error;
        }
    }

    async logout() {
        try {
            if (this.isReady && this.client) {
                await this.client.logout();
                console.log(`WhatsApp client logged out for ${this.clientId}`);
            }
            
            this.isReady = false;
            this.currentQR = null;
            this.isInitialized = false;
            
            return true;
        } catch (error) {
            console.error(`Error during logout for ${this.clientId}:`, error);
            // Even if logout fails, clear the state
            this.isReady = false;
            this.currentQR = null;
            this.isInitialized = false;
            return true;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.destroy();
                console.log(`WhatsApp client disconnected for ${this.clientId}`);
            }
            
            this.client = null;
            this.isReady = false;
            this.currentQR = null;
            this.isInitialized = false;
            
        } catch (error) {
            console.error(`Error disconnecting client for ${this.clientId}:`, error);
        }
    }

    async verifyStoreObjects() {
        try {
            if (!this.client || !this.client.pupPage) {
                return { allLoaded: false, reason: 'No client or page available' };
            }

            const page = this.client.pupPage;
            const result = await page.evaluate(() => {
                try {
                    // Check if Store objects exist and are functional
                    const storeExists = !!(window.Store && window.Store.Contact && window.Store.Chat && window.Store.Msg);
                    
                    if (!storeExists) {
                        return { 
                            allLoaded: false, 
                            reason: 'Store objects not found',
                            storeExists: false,
                            contactGetWorks: false,
                            chatGetWorks: false
                        };
                    }

                    // Test if Contact.get is callable (more lenient check)
                    let contactGetWorks = false;
                    try {
                        if (window.Store.Contact && typeof window.Store.Contact.get === 'function') {
                            // Just check if the function exists, don't call it
                            contactGetWorks = true;
                        }
                    } catch (e) {
                        contactGetWorks = false;
                    }

                    // Test if Chat.get is callable (more lenient check)
                    let chatGetWorks = false;
                    try {
                        if (window.Store.Chat && typeof window.Store.Chat.get === 'function') {
                            // Just check if the function exists, don't call it
                            chatGetWorks = true;
                        }
                    } catch (e) {
                        chatGetWorks = false;
                    }

                    // More lenient check - if Store exists and has the main objects, consider it ready
                    const allLoaded = storeExists && (contactGetWorks || chatGetWorks);
                    
                    return {
                        allLoaded,
                        storeExists,
                        contactGetWorks,
                        chatGetWorks,
                        reason: allLoaded ? 'Store objects functional' : 'Store objects not fully functional'
                    };
                } catch (error) {
                    return { 
                        allLoaded: false, 
                        reason: `Evaluation error: ${error.message}`,
                        storeExists: false,
                        contactGetWorks: false,
                        chatGetWorks: false
                    };
                }
            });

            return result;
        } catch (error) {
            console.error(`Error verifying Store objects for ${this.clientId}:`, error);
            return { 
                allLoaded: false, 
                reason: `Verification error: ${error.message}`,
                storeExists: false,
                contactGetWorks: false,
                chatGetWorks: false
            };
        }
    }

    async getCurrentStatus() {
        try {
            if (this.isReady) {
                try {
                    // Verify that Store objects are actually functional before reporting as ready
                    const storeStatus = await this.verifyStoreObjects();
                    if (!storeStatus.allLoaded) {
                        console.log(`Store objects not fully loaded for ${this.clientId}, reporting as not ready`);
                        return {
                            isReady: false,
                            authenticated: false,
                            hasQR: !!this.currentQR,
                            qr: this.currentQR || '',
                            reason: 'Store objects not ready'
                        };
                    }
                    
                    const userInfo = await this.getUserInfo();
                    return {
                        isReady: true,
                        authenticated: true,
                        userInfo: userInfo
                    };
                } catch (error) {
                    // If Store verification or user info fails, don't report as ready
                    console.log(`Store verification or user info failed for ${this.clientId}: ${error.message}`);
                    return {
                        isReady: false,
                        authenticated: false,
                        hasQR: !!this.currentQR,
                        qr: this.currentQR || '',
                        reason: 'Store verification failed'
                    };
                }
            }
            
            return {
                isReady: false,
                authenticated: false,
                hasQR: !!this.currentQR,
                qr: this.currentQR || ''
            };
        } catch (error) {
            console.error(`Error getting current status for ${this.clientId}:`, error);
            return {
                isReady: false,
                authenticated: false,
                error: error.message
            };
        }
    }

    async getUserInfo() {
        try {
            if (!this.client || !this.isReady) {
                return null;
            }
            
            // Prefer cheap, already-populated info
            const info = this.client.info || {};
            const wid = info.wid || info.me || {};
            
            // Extract phone number properly
            let phoneNumber = 'Unknown';
            if (wid) {
                if (typeof wid === 'string') {
                    phoneNumber = wid;
                } else if (wid.user) {
                    phoneNumber = wid.user;
                } else if (wid._serialized) {
                    phoneNumber = wid._serialized;
                } else if (wid.id) {
                    phoneNumber = wid.id;
                }
            }
            
            const displayName = info.pushname || info.displayName || info.name || 'Unknown';
            
            if (info && (info.pushname || phoneNumber !== 'Unknown')) {
                return {
                    name: displayName,
                    phoneNumber: phoneNumber,
                    pushName: info.pushname || displayName
                };
            }
            
            // Fallbacks for older versions/APIs
            if (typeof this.client.getMe === 'function') {
                try {
                    const me = await this.client.getMe();
                    if (me) {
                        let mePhoneNumber = 'Unknown';
                        if (me.user) {
                            mePhoneNumber = me.user;
                        } else if (me._serialized) {
                            mePhoneNumber = me._serialized;
                        } else if (me.id) {
                            mePhoneNumber = me.id;
                        }
                        
                        return {
                            name: displayName,
                            phoneNumber: mePhoneNumber,
                            pushName: info.pushname || displayName
                        };
                    }
                } catch (_) {
                    // ignore
                }
            }
            
            if (typeof this.client.getContacts === 'function') {
                try {
                    const contacts = await this.client.getContacts();
                    const meContact = Array.isArray(contacts) ? contacts.find(c => c && c.isMe) : null;
                    if (meContact) {
                        let contactPhoneNumber = 'Unknown';
                        if (meContact.number) {
                            contactPhoneNumber = meContact.number;
                        } else if (meContact.id && meContact.id._serialized) {
                            contactPhoneNumber = meContact.id._serialized;
                        }
                        
                        return {
                            name: meContact.name || meContact.pushname || displayName,
                            phoneNumber: contactPhoneNumber,
                            pushName: meContact.pushname || meContact.name || displayName
                        };
                    }
                } catch (_) {
                    // ignore expensive fallback failures
                }
            }
            
            return null;
        } catch (error) {
            console.log(`Error getting user info for ${this.clientId}:`, error.message);
            return null;
        }
    }

    async checkSessionValidity() {
        try {
            if (!this.isReady) {
                return false;
            }
            
            const userInfo = await this.getUserInfo();
            if (userInfo) {
                console.log(`Session is valid for ${this.clientId}, user: ${userInfo.pushName || userInfo.name}`);
                return true;
            } else {
                console.log(`Session appears invalid for ${this.clientId}, no user info found`);
                return false;
            }
        } catch (error) {
            console.error(`Error checking session validity for ${this.clientId}:`, error);
            return false;
        }
    }

    async checkConnectionStatus() {
        try {
            // Throttle connection status checks to prevent excessive calls
            const now = Date.now();
            const lastCheck = this._lastConnectionStatusCheck || 0;
            const throttleInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
            
            // If called within 5 minutes and we have cached status, return cached result
            if (now - lastCheck < throttleInterval && this._cachedConnectionStatus) {
                return this._cachedConnectionStatus;
            }
            
            // Update last check time
            this._lastConnectionStatusCheck = now;
            
            if (!this.client) {
                const result = { connected: false, reason: 'No client' };
                this._cachedConnectionStatus = result;
                console.log(`No client available for ${this.clientId}`);
                return result;
            }

            if (!this.isInitialized) {
                const result = { connected: false, reason: 'Not initialized' };
                this._cachedConnectionStatus = result;
                console.log(`Client not initialized for ${this.clientId}`);
                return result;
            }

            if (this.isReady) {
                const result = { connected: true, reason: 'Ready' };
                this._cachedConnectionStatus = result;
                console.log(`Client is ready for ${this.clientId}`);
                return result;
            }

            if (this.currentQR) {
                const result = { connected: false, reason: 'QR available', qr: this.currentQR };
                this._cachedConnectionStatus = result;
                console.log(`Client has QR code for ${this.clientId}`);
                return result;
            }

            const result = { connected: false, reason: 'Unknown state' };
            this._cachedConnectionStatus = result;
            console.log(`Client is in unknown state for ${this.clientId}`);
            return result;
        } catch (error) {
            console.error(`Error checking connection status for ${this.clientId}:`, error);
            const result = { connected: false, reason: 'Error', error: error.message };
            this._cachedConnectionStatus = result;
            return result;
        }
    }
}

module.exports = { WhatsAppAuth };

# Whatsapp Web 

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { WhatsAppService } = require('./service');
const { sessionManager } = require('./sessionManager');

class WhatsAppServer {
    constructor(port = 7093, host = '0.0.0.0') {
        this.app = express();
        this.port = port;
        this.host = host;
        this.services = new Map();
        
        const sanitizeClientId = (value) => {
            try {
                let sanitized = String(value || 'default')
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, '_')
                    .slice(0, 64);
                
                sanitized = sanitized.replace(/^_+|_+$/g, '');
                return sanitized;
            } catch (_) {
                return 'default';
            }
        };
        
        this.getServiceKey = (req) => {
            try {
                const bodyEmail = (req.body && (req.body.user_email || req.body.email)) || '';
                const headerEmail = req.headers['x-user-email'] || '';
                const raw = String(bodyEmail || headerEmail || 'default').toLowerCase();
                const clientId = sanitizeClientId(raw) || 'default';
                
                return clientId;
            } catch (error) {
                console.error(`[ERROR] Error generating service key:`, error);
                return 'default';
            }
        };
        
        this.getServiceForRequest = async (req) => {
            const key = this.getServiceKey(req);
            // Use sessionManager for proper session management and concurrency control
            return await sessionManager.getServiceForClient(key);
        };
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    // Removed performStartupCleanup - cleanup only happens in start.js now

    setupMiddleware() {
        this.app.use(cors({
            origin: [
                'https://admin.bajajearths.com',
                'https://whatsapp.bajajearths.com',
                'https://adminbackend.bajajearths.com'
                
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Email', 'x-user-email']
        }));
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Function to get user-specific uploads directory
        const getUserUploadsDir = (userEmail) => {
            const sanitizedEmail = userEmail ? userEmail.replace(/[^a-zA-Z0-9._-]/g, '_') : 'unknown_user';
            const userDir = path.join(process.cwd(), 'uploads', `${sanitizedEmail}_temp`);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
            return userDir;
        };

        const baseUploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(baseUploadsDir)) {
            fs.mkdirSync(baseUploadsDir, { recursive: true });
        }
        
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                // Get user email from request headers or body
                const userEmail = req.headers['x-user-email'] || req.body?.user_email || req.body?.email;
                const userDir = getUserUploadsDir(userEmail);
                cb(null, userDir);
            },
            filename: (req, file, cb) => {
                const original = file.originalname;
                const parts = original.split('-', 2);
                const cleaned = (parts.length === 2 && /^\d{10,}$/.test(parts[0])) ? parts[1] : original;
                cb(null, cleaned);
            }
        });
        this.upload = multer({ storage });

        this.cleanUserUploads = (userEmail) => {
            try {
                const userDir = getUserUploadsDir(userEmail);
                if (fs.existsSync(userDir)) {
                    const files = fs.readdirSync(userDir);
                    for (const f of files) {
                        try {
                            fs.unlinkSync(path.join(userDir, f));
                        } catch (e) {
                            console.warn('Failed to delete user upload file', f, e.message);
                        }
                    }
                    console.log(`Cleaned up uploads for user: ${userEmail}`);
                }
            } catch (e) {
                console.warn('Failed to clean user uploads directory', e.message);
            }
        };

        this.cleanUploads = () => {
            // Legacy cleanup - clean all uploads (for backward compatibility)
            try {
                const files = fs.readdirSync(baseUploadsDir);
                for (const f of files) {
                    try {
                        const filePath = path.join(baseUploadsDir, f);
                        if (fs.statSync(filePath).isDirectory()) {
                            // Clean user-specific directories
                            const userFiles = fs.readdirSync(filePath);
                            for (const userFile of userFiles) {
                                fs.unlinkSync(path.join(filePath, userFile));
                            }
                            fs.rmdirSync(filePath);
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    } catch (e) {
                        console.warn('Failed to delete upload file', f, e.message);
                    }
                }
            } catch (e) {
                console.warn('Failed to read uploads directory', e.message);
            }
        };
    }

    setupRoutes() {
        this.app.get('/health', async (req, res) => {
            try {
                const svc = await this.getServiceForRequest(req);
                res.json({ 
                    status: 'ok', 
                    whatsappReady: svc.isReady,
                    whatsappInitialized: svc.isInitialized,
                    hasQR: !!svc.currentQR,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error in /health:', error);
                res.status(500).json({ 
                    status: 'error', 
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });


        this.app.get('/status', async (req, res) => {
            try {
                const svc = await this.getServiceForRequest(req);
                const status = await svc.getCurrentStatus();
                
                res.json({
                    ...status,
                    status: status.isReady ? 'ready' : 'initializing'
                });
            } catch (error) {
                console.error('Error in /status:', error);
                res.status(500).json({ 
                    isReady: false, 
                    status: 'error',
                    error: error.message 
                });
            }
        });

        // Alias for /status to match frontend expectations
        this.app.get('/api/whatsapp-status', async (req, res) => {
            try {
                const svc = await this.getServiceForRequest(req);
                const status = await svc.getCurrentStatus();
                const connectionStatus = await svc.checkConnectionStatus();
                
                res.json({
                    ...status,
                    status: status.isReady ? 'ready' : 'initializing',
                    connectionStatus: connectionStatus
                });
            } catch (error) {
                console.error('Error in /api/whatsapp-status:', error);
                res.status(500).json({ 
                    isReady: false, 
                    status: 'error',
                    error: error.message 
                });
            }
        });

        // QR code endpoint
        this.app.get('/api/qr', async (req, res) => {
            try {
                const svc = await this.getServiceForRequest(req);
                const qr = svc.currentQR || '';
                res.json({ 
                    success: true, 
                    data: { qr }, 
                    qr,
                    isReady: svc.isReady,
                    authenticated: svc.isReady
                });
            } catch (error) {
                console.error('Error in /api/qr:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        this.app.get('/auth-status', async (req, res) => {
            try {
                const svc = await this.getServiceForRequest(req);
                const status = await svc.getCurrentStatus();
                        
                if (status.isReady && status.authenticated) {
                    res.json({
                        authenticated: true,
                        userInfo: status.userInfo || {
                            name: 'Authenticated User',
                            phoneNumber: 'Unknown',
                            pushName: 'Unknown'
                        }
                    });
                } else {
                    res.json({
                        authenticated: false,
                        userInfo: null
                    });
                }
            } catch (error) {
                console.error('Error checking auth status:', error);
                res.status(500).json({
                    authenticated: false,
                    userInfo: null,
                    error: error.message
                });
            }
        });

        this.app.post('/logout', async (req, res) => {
            try {
                const svc = await this.getServiceForRequest(req);
                const success = await svc.logout();
                if (success) {
                    res.json({ success: true, message: 'Logged out successfully' });
                } else {
                    res.status(500).json({ success: false, message: 'Logout failed' });
                }
            } catch (error) {
                console.error('Error during logout:', error);
                res.status(500).json({ success: false, message: 'Logout error: ' + error.message });
            }
        });



        // Alias for /trigger-login to match frontend expectations
        this.app.post('/api/whatsapp-login', async (req, res) => {
            try {
                const service = await this.getServiceForRequest(req);
                
                // If service is already ready, return immediately
                if (service.isReady) {
                    try {
                        const status = await service.getCurrentStatus();
                        if (status.isReady && status.authenticated && status.userInfo) {
                            const result = {
                                isReady: true,
                                qr: '',
                                authenticated: true,
                                userInfo: status.userInfo
                            };
                            return res.json({
                                success: true,
                                data: result,
                                ...result
                            });
                        }
                    } catch (error) {
                        console.log('Session validation failed, proceeding with fresh login');
                        service.isReady = false;
                        service.isInitialized = false;
                    }
                }
                
                // If QR is already available, return it immediately
                if (service.currentQR) {
                    return res.json({
                        success: true,
                        data: {
                            isReady: service.isReady,
                            qr: service.currentQR,
                            authenticated: false
                        },
                        isReady: service.isReady,
                        qr: service.currentQR,
                        authenticated: false
                    });
                }
                
                // Otherwise, trigger login
                const result = await service.triggerLogin();
                
                res.json({
                    success: true,
                    data: result,
                    ...result
                });
                
            } catch (error) {
                console.error('Error in /api/whatsapp-login:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/trigger-login', async (req, res) => {
            try {
                const service = await this.getServiceForRequest(req);
                
                // If service is already ready, return immediately
                if (service.isReady) {
                    try {
                        const status = await service.getCurrentStatus();
                        if (status.isReady && status.authenticated && status.userInfo) {
                            const result = {
                                isReady: true,
                                qr: '',
                                authenticated: true,
                                userInfo: status.userInfo
                            };
                            return res.json({
                                success: true,
                                data: result,
                                ...result
                            });
                        }
                    } catch (error) {
                        console.log('Session validation failed, proceeding with fresh login');
                        service.isReady = false;
                        service.isInitialized = false;
                    }
                }
                
                // If QR is already available, return it immediately
                if (service.currentQR) {
                    return res.json({
                        success: true,
                        data: {
                            isReady: service.isReady,
                            qr: service.currentQR,
                            authenticated: false
                        },
                        isReady: service.isReady,
                        qr: service.currentQR,
                        authenticated: false
                    });
                }
                
                // Otherwise, trigger login
                const result = await service.triggerLogin();
                
                res.json({
                    success: true,
                    data: result,
                    ...result
                });
                
            } catch (error) {
                console.error('Error in /trigger-login:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/send-message', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contact_name,
                    whatsapp_number,
                    process_name = 'salary_slip',
                    message = '',
                    variables = '{}',
                    options = '{}',
                    file_sequence = '[]'
                } = req.body;

                // Parse JSON strings if needed
                let parsedVariables = {};
                let parsedOptions = {};
                let parsedFileSequence = [];
                
                try {
                    parsedVariables = typeof variables === 'string' ? JSON.parse(variables) : variables;
                } catch (e) {
                    console.warn('Invalid variables JSON, using empty object:', e.message);
                }
                
                try {
                    parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
                } catch (e) {
                    console.warn('Invalid options JSON, using empty object:', e.message);
                }

                try {
                    parsedFileSequence = typeof file_sequence === 'string' ? JSON.parse(file_sequence) : file_sequence;
                } catch (e) {
                    console.warn('Invalid file_sequence JSON, using empty array:', e.message);
                }

                const filePaths = req.files ? req.files.map(file => file.path) : [];

                // Debug logging
                console.log(`Received request for ${contact_name}:`);
                console.log(`  - Message: "${message}"`);
                console.log(`  - File sequence:`, parsedFileSequence);
                console.log(`  - File paths:`, filePaths);

                const service = await this.getServiceForRequest(req);
                const result = await service.sendWhatsAppMessage(
                    contact_name,
                    message, // Use provided message or empty string for template fallback
                    filePaths,
                    parsedFileSequence, // Pass file_sequence for sequencing
                    whatsapp_number,
                    process_name,
                    {
                        ...parsedOptions,
                        variables: parsedVariables
                    }
                );

                // Check if the message was actually sent successfully
                const messageSent = !!result;
                if (messageSent) {
                    res.json({ success: true, data: { sent: true, contact_name } });
                } else {
                    res.json({ success: false, error: `Failed to send message to ${contact_name}`, details: 'Message sending failed after all retry attempts' });
                }
            } catch (error) {
                console.error('Error in /send-message:', error);
                res.status(500).json({ success: false, error: error.message });
            } finally {
                // Get user email for cleanup
                const userEmail = req.headers['x-user-email'] || req.body?.user_email || req.body?.email;
                if (userEmail) {
                    this.cleanUserUploads(userEmail);
                } else {
                    this.cleanUploads(); // Fallback to legacy cleanup
                }
            }
        });

        this.app.post('/send-bulk', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contacts, // Array of contact objects
                    process_name = 'salary_slip',
                    message = '',
                    variables = '{}',
                    options = '{}',
                    file_sequence = '[]'
                } = req.body;

                // Parse JSON strings if needed
                let parsedContacts = [];
                let parsedVariables = {};
                let parsedOptions = {};
                let parsedFileSequence = [];
                
                try {
                    parsedContacts = typeof contacts === 'string' ? JSON.parse(contacts) : contacts;
                } catch (e) {
                    console.error('Invalid contacts JSON:', e.message);
                    return res.status(400).json({ success: false, error: 'Invalid contacts data' });
                }
                
                try {
                    parsedVariables = typeof variables === 'string' ? JSON.parse(variables) : variables;
                } catch (e) {
                    console.warn('Invalid variables JSON, using empty object:', e.message);
                }
                
                try {
                    parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
                } catch (e) {
                    console.warn('Invalid options JSON, using empty object:', e.message);
                }

                try {
                    parsedFileSequence = typeof file_sequence === 'string' ? JSON.parse(file_sequence) : file_sequence;
                } catch (e) {
                    console.warn('Invalid file_sequence JSON, using empty array:', e.message);
                }

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const service = await this.getServiceForRequest(req);
                const results = await service.sendBulkMessages(
                    parsedContacts.map(c => ({
                        name: c.name,
                        phoneNumber: c.whatsapp_number || c.phoneNumber || c.phone
                    })),
                    message, // Use provided message or empty string for template fallback
                    filePaths,
                    parsedFileSequence, // Pass file_sequence for sequencing
                    process_name,
                    {
                        ...parsedOptions,
                        variables: parsedVariables
                    }
                );

                res.json({ success: true, data: { 
                    results,
                    total_processed: results.length,
                    successful: results.filter(r => r.success).length
                }});
            } catch (error) {
                console.error('Error in /send-bulk:', error);
                res.status(500).json({ success: false, error: error.message });
            } finally {
                // Get user email for cleanup
                const userEmail = req.headers['x-user-email'] || req.body?.user_email || req.body?.email;
                if (userEmail) {
                    this.cleanUserUploads(userEmail);
                } else {
                    this.cleanUploads(); // Fallback to legacy cleanup
                }
            }
        });
    }

    async start() {
        this.app.listen(this.port, this.host, () => {
            console.log(`WhatsApp server running on ${this.host}:${this.port}`);
            console.log(`Health check: http://${this.host}:${this.port}/health`);
            console.log(`Domain access: https://whatsapp.bajajearths.com/health`);
            console.log('WhatsApp service is ready to accept requests');
        });
    }

    async stop() {
        try {
            console.log('WhatsApp server stopped successfully');
        } catch (error) {
            console.error('Error stopping WhatsApp server:', error);
        }
    }
}

function createService() {
    return new WhatsAppService();
}

module.exports = { WhatsAppService, WhatsAppServer, createService };

# Service 

const { WhatsAppAuth } = require('./auth');
const { WhatsAppMessaging } = require('./messaging');

class WhatsAppService {
    constructor(clientId = 'default') {
        this.clientId = String(clientId);
        this.authClient = new WhatsAppAuth(clientId);
        this.messagingClient = new WhatsAppMessaging(this.authClient);
        
        // Expose auth properties for backward compatibility
        this.isReady = false;
        this.currentQR = null;
        this.isInitialized = false;
        
        // Sync auth state
        this.syncAuthState();
        
        // Auto-initialize the service
        this.autoInitialize();
    }

    syncAuthState() {
        // Sync the auth state from the auth client
        this.isReady = this.authClient.isReady;
        this.currentQR = this.authClient.currentQR;
        this.isInitialized = this.authClient.isInitialized;
        
        // Set up listeners to keep state in sync - always set them up on the authClient
        // Remove any existing listeners first to avoid duplicates
        this.authClient.removeAllListeners('ready');
        this.authClient.removeAllListeners('qr');
        this.authClient.removeAllListeners('disconnected');
        
        // Set up new listeners
        this.authClient.on('ready', () => {
            this.isReady = true;
            this.currentQR = null;
            // Only log once when state changes
            if (!this._lastReadyState) {
                console.log(`Service state synced - ready: true for clientId: ${this.clientId}`);
                this._lastReadyState = true;
            }
        });
        
        this.authClient.on('qr', (qr) => {
            this.currentQR = qr;
            // Only log once when QR is received
            if (!this._lastQRState) {
                console.log(`Service state synced - QR received for clientId: ${this.clientId}`);
                this._lastQRState = true;
            }
        });
        
        this.authClient.on('disconnected', () => {
            this.isReady = false;
            this.currentQR = null;
            // Reset state tracking
            this._lastReadyState = false;
            this._lastQRState = false;
            console.log(`Service state synced - disconnected for clientId: ${this.clientId}`);
        });
    }

    autoInitialize() {
        try {
            console.log(`Auto-initializing WhatsApp service for clientId: ${this.clientId}`);
            // Don't await - make it non-blocking
            this.authClient.initialize().then(() => {
                this.syncAuthState();
                console.log(`Auto-initialization completed for clientId: ${this.clientId}`);
            }).catch((error) => {
                console.error(`Auto-initialization failed for clientId: ${this.clientId}:`, error);
            });
        } catch (error) {
            console.error(`Auto-initialization setup failed for clientId: ${this.clientId}:`, error);
        }
    }

    // Delegate auth methods to auth client
    async checkSessionValidity() {
        return this.authClient.checkSessionValidity();
    }

    async forceNewSession() {
        return this.authClient.forceNewSession();
    }

    async recoverSession() {
        return this.authClient.recoverSession();
    }

    async waitForReady() {
        return this.authClient.waitForReady();
    }

    async triggerLogin(timeoutMs = 360000) {
        return this.authClient.triggerLogin(timeoutMs);
    }

    async logout() {
        return this.authClient.logout();
    }

    async disconnect() {
        return this.authClient.disconnect();
    }

    async getCurrentStatus() {
        return this.authClient.getCurrentStatus();
    }

    async getUserInfoWithoutSync() {
        return this.authClient.getUserInfo();
    }

    async checkConnectionStatus() {
        return this.authClient.checkConnectionStatus();
    }

    // Delegate messaging methods to messaging client
    async sendWhatsAppMessage(contactName, message, filePaths = [], fileSequence = [], whatsappNumber, processName, options = {}) {
        return this.messagingClient.sendWhatsAppMessage(contactName, message, filePaths, fileSequence, whatsappNumber, processName, options);
    }

    async sendBulkMessages(contacts, message, filePaths = [], fileSequence = [], processName = 'salary_slip', options = {}) {
        return this.messagingClient.sendBulkMessages(contacts, message, filePaths, fileSequence, processName, options);
    }

    async prepareFilePaths(filePaths, userEmail = null, baseOutputDir = null, isUpload = false) {
        return this.messagingClient.prepareFilePaths(filePaths, userEmail, baseOutputDir, isUpload);
    }

    formatPhoneNumber(phoneNumber, processName = null) {
        return this.messagingClient.formatPhoneNumber(phoneNumber, processName);
    }

    getMessageTemplate(processName, messageType = 'default', variables = {}) {
        return this.messagingClient.getMessageTemplate(processName, messageType, variables);
    }
}

module.exports = { WhatsAppService };

# messaging 

const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

class WhatsAppMessaging {
    constructor(authClient) {
        this.authClient = authClient;
        this.messageTemplates = null;
        
        // Load message templates
        this.loadMessageTemplates();
    }

    loadMessageTemplates() {
        try {
            const messagePath = path.join(__dirname, 'message.json');
            if (fs.existsSync(messagePath)) {
                const messageData = fs.readFileSync(messagePath, 'utf8');
                this.messageTemplates = JSON.parse(messageData);
                console.log('Message templates loaded successfully');
            } else {
                console.warn('Message templates file not found, using fallback');
                this.messageTemplates = null;
            }
        } catch (error) {
            console.error('Error loading message templates:', error);
            this.messageTemplates = null;
        }
    }

    getMessageTemplate(processName, messageType = 'default', variables = {}) {
        try {
            if (!this.messageTemplates || !this.messageTemplates.processes) {
                return null;
            }

            const process = this.messageTemplates.processes[processName];
            if (!process || !process.whatsapp) {
                return null;
            }

            let template;
            if (messageType === 'single' || messageType === 'multiple') {
                template = process.whatsapp[messageType];
            } else {
                template = process.whatsapp.default || process.whatsapp[messageType];
            }

            if (!template) {
                return null;
            }

            let message = Array.isArray(template) ? template.join('\n') : template;

            // Replace variables in the message
            for (const [key, value] of Object.entries(variables)) {
                const placeholder = `{${key}}`;
                message = message.replace(new RegExp(placeholder, 'g'), value || '');
            }

            return message;
        } catch (error) {
            console.error('Error getting message template:', error);
            return null;
        }
    }

    async sendMessageWithRetry(formattedNumber, message, maxRetries = 3) {
        let messageSent = false;
        let retryCount = 0;
        
        while (!messageSent && retryCount < maxRetries) {
            try {
                // Test WhatsApp Web Store objects before sending message
                const page = this.authClient.client.pupPage;
                let sendTestResult = null;
                
                if (page) {
                    sendTestResult = await page.evaluate(() => {
                        try {
                            const result = {
                                storeExists: !!window.Store,
                                chatStoreExists: !!(window.Store && window.Store.Chat),
                                getChatExists: !!(window.Store && window.Store.Chat && window.Store.Chat.get),
                                getChatType: window.Store && window.Store.Chat && window.Store.Chat.get ? typeof window.Store.Chat.get : 'undefined',
                                storeKeys: window.Store ? Object.keys(window.Store) : [],
                                chatKeys: window.Store && window.Store.Chat ? Object.keys(window.Store.Chat) : []
                            };
                            
                            // Try to actually call the function and check if it's properly initialized
                            if (window.Store && window.Store.Chat && window.Store.Chat.get) {
                                try {
                                    const testCall = window.Store.Chat.get('test@c.us');
                                    result.testCallSuccess = true;
                                    result.testCallResult = 'success';
                                } catch (e) {
                                    result.testCallError = e.message;
                                    result.testCallSuccess = false;
                                    
                                    // Check if it's a proper WhatsApp error (function is working) or an undefined error (function not ready)
                                    if (e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties')) {
                                        result.testCallResult = 'whatsapp_error'; // Function is working but WhatsApp returned an error
                                    } else {
                                        result.testCallResult = 'function_not_ready'; // Function is not properly initialized
                                    }
                                }
                            } else {
                                result.testCallResult = 'function_not_available';
                            }
                            
                            return result;
                        } catch (e) {
                            return { error: e.message };
                        }
                    });
                }
                
                // Only proceed with sending if Store objects are properly initialized
                if (!sendTestResult || sendTestResult.testCallResult === 'success' || sendTestResult.testCallResult === 'whatsapp_error') {
                    if (Array.isArray(message)) {
                        await this.authClient.client.sendMessage(formattedNumber, message.join('\n'));
                    } else {
                        await this.authClient.client.sendMessage(formattedNumber, message);
                    }
                } else {
                    // If Store objects aren't ready, try a different approach
                    console.log(`Store objects not ready (${sendTestResult.testCallResult}), attempting direct messaging...`);
                    
                    // Wait a bit more and try again
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Try to send message directly without Store validation
                    if (Array.isArray(message)) {
                        await this.authClient.client.sendMessage(formattedNumber, message.join('\n'));
                    } else {
                        await this.authClient.client.sendMessage(formattedNumber, message);
                    }
                }
                console.log(`Message sent successfully`);
                messageSent = true;
            } catch (messageError) {
                retryCount++;
                console.error(`Error sending message (attempt ${retryCount}/${maxRetries}):`, messageError);
                
                if (retryCount < maxRetries) {
                    // Wait before retrying - longer wait for WhatsApp Web to stabilize
                    const waitTime = retryCount * 3000; // Progressive backoff: 3s, 6s, 9s
                    console.log(`Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    
                    // Try to refresh client state if possible
                    try {
                        const state = await this.authClient.client.getState();
                        console.log(`Client state after error: ${state}`);
                    } catch (stateError) {
                        console.warn(`Could not get client state:`, stateError.message);
                    }
                    
                    // Wait for Store objects before retry
                    console.log(`Waiting for Store objects before retry ${retryCount + 1}/${maxRetries}`);
                    await this.waitForWhatsAppStore(30000); // Wait up to 30 seconds for retry
                }
            }
        }
        
        return messageSent;
    }

    async sendWhatsAppMessage(contactName, message, filePaths = [], fileSequence = [], whatsappNumber, processName, options = {}) {
        try {
            // Debug logging
            console.log(`sendWhatsAppMessage called for ${contactName}:`);
            console.log(`  - Message: "${message}"`);
            console.log(`  - File sequence:`, fileSequence);
            console.log(`  - Process name: ${processName}`);
            console.log(`  - Options:`, options);
            
            await this.authClient.waitForReady();

            if (!whatsappNumber) {
                console.error(`Phone number not found for ${contactName}`);
                return false;
            }

            const formattedNumber = this.formatPhoneNumber(whatsappNumber, processName);
            
            // Check if phone number is valid
            if (!formattedNumber) {
                console.error(`❌ Invalid phone number for ${contactName}: ${whatsappNumber}. Skipping message.`);
                return false;
            }
            
            console.log(`Sending message to ${contactName} (${formattedNumber})`);

            // Ensure client is ready before trying to get contact
            if (!this.authClient.isReady) {
                console.error(`WhatsApp client is not ready for ${contactName}`);
                return false;
            }

            // Try to send message directly - if it fails, then we'll handle validation
            // This approach is more reliable than pre-validation since WhatsApp Web can be inconsistent
            console.log(`Attempting to send message to ${contactName} - client reports as ready`);
            
            // Optional: Try a lightweight validation first (just check if we can get state)
            try {
                const clientState = await this.authClient.client.getState();
                console.log(`Client state check: ${clientState}`);
                if (clientState === 'UNPAIRED' || clientState === 'UNLAUNCHED') {
                    console.error(`Client is not properly authenticated: ${clientState}`);
                    return false;
                }
            } catch (stateError) {
                console.warn(`Could not check client state, but continuing:`, stateError.message);
                // Continue anyway - sometimes state check fails but messaging works
            }

            // Wait for WhatsApp Web Store objects to be available (with timeout)
            console.log('Waiting for WhatsApp Web Store objects to be available...');
            await this.waitForWhatsAppStore(120000); // Wait up to 2 minutes for proper initialization

            let contact;
            try {
                // Check if page is available before trying to get contact
                const page = this.authClient.client.pupPage;
                if (!page) {
                    console.log(`Page not available, attempting to send message directly to ${formattedNumber}`);
                } else {
                    // First, let's test what the WhatsApp Web library is actually trying to access
                    const testResult = await page.evaluate(() => {
                        try {
                            // Test the exact same code that whatsapp-web.js is trying to execute
                            const result = {
                                storeExists: !!window.Store,
                                contactStoreExists: !!(window.Store && window.Store.Contact),
                                getContactExists: !!(window.Store && window.Store.Contact && window.Store.Contact.get),
                                getContactType: window.Store && window.Store.Contact && window.Store.Contact.get ? typeof window.Store.Contact.get : 'undefined',
                                storeKeys: window.Store ? Object.keys(window.Store) : [],
                                contactKeys: window.Store && window.Store.Contact ? Object.keys(window.Store.Contact) : []
                            };
                            
                            // Try to actually call the function and check if it's properly initialized
                            if (window.Store && window.Store.Contact && window.Store.Contact.get) {
                                try {
                                    const testCall = window.Store.Contact.get('test@c.us');
                                    result.testCallSuccess = true;
                                    result.testCallResult = 'success';
                                } catch (e) {
                                    result.testCallError = e.message;
                                    result.testCallSuccess = false;
                                    
                                    // Check if it's a proper WhatsApp error (function is working) or an undefined error (function not ready)
                                    if (e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties')) {
                                        result.testCallResult = 'whatsapp_error'; // Function is working but WhatsApp returned an error
                                    } else {
                                        result.testCallResult = 'function_not_ready'; // Function is not properly initialized
                                    }
                                }
                            } else {
                                result.testCallResult = 'function_not_available';
                            }
                            
                            return result;
                        } catch (e) {
                            return { error: e.message };
                        }
                    });
                    
                    
                    // Only try to get contact if Store objects are properly initialized
                    if (testResult.testCallResult === 'success' || testResult.testCallResult === 'whatsapp_error') {
                        contact = await this.authClient.client.getContactById(formattedNumber);
                        if (!contact) {
                            console.error(`Contact not found: ${contactName} (${formattedNumber})`);
                            return false;
                        }
                    } else {
                        console.log(`Store objects not ready for contact lookup, proceeding with direct messaging to ${formattedNumber}`);
                    }
                }
            } catch (contactError) {
                console.error(`Error getting contact ${contactName}:`, contactError);
                // Try to send message directly without contact validation
                console.log(`Attempting to send message directly to ${formattedNumber}`);
            }

            let finalMessage = message;
            console.log(`Initial message: "${message}"`);
            
            // Only use template fallback if no message is provided or message is empty
            // Skip template fallback for 'report' process as it should always use user-provided content
            if (processName && processName !== 'report' && (!message || (typeof message === 'string' && message.trim() === ''))) {
                const templateVariables = {
                    contact_name: contactName,
                    ...options.variables || {}
                };
                
                let messageType = 'default';
                if (processName === 'salary_slip') {
                    // Determine message type based on variables or options
                    if (options.isMultiple || (templateVariables.months_list && templateVariables.months_list.length > 0)) {
                        messageType = 'multiple';
                    } else if (templateVariables.full_month && templateVariables.full_year) {
                        messageType = 'single';
                    }
                }
                
                const templateMessage = this.getMessageTemplate(processName, messageType, templateVariables);
                if (templateMessage) {
                    finalMessage = templateMessage;
                    console.log(`Using template message for process: ${processName}, type: ${messageType}`);
                }
            } else if (message && typeof message === 'string' && message.trim() !== '') {
                // Use the provided message content (from user's template file)
                finalMessage = message;
                console.log(`Using user-provided message content for ${contactName}`);
            } else if (processName === 'report') {
                // For report process, if no message is provided, log a warning
                console.warn(`No message content provided for report process for ${contactName}. This should not happen.`);
                finalMessage = message || ''; // Use empty string as fallback
            }
            
            console.log(`Final message after processing: "${finalMessage}"`);

            const validFilePaths = await this.prepareFilePaths(filePaths);
            const perFileDelayMs = Number(options.perFileDelayMs || 1000);

            // Only send message immediately if there's no sequencing and not using template as caption
            // If using template as caption and there are files, the message will be sent as caption
            if (finalMessage && (!fileSequence || fileSequence.length === 0)) {
                // Don't send message as separate text if using template as caption and there are files
                if (options.use_template_as_caption && validFilePaths.length > 0) {
                    console.log(`Skipping separate message send - will use as caption for files`);
                } else {
                    const messageSent = await this.sendMessageWithRetry(formattedNumber, finalMessage);
                    if (!messageSent) {
                        console.error(`Failed to send message to ${contactName}`);
                        return false;
                    }
                    console.log(`Message sent to ${contactName}`);
                }
            }

            // Handle sequencing: send items in the order specified by fileSequence
            if (fileSequence && fileSequence.length > 0) {
                console.log(`Sending items in sequence order for ${contactName}`);
                console.log(`File sequence items:`, fileSequence);
                
                // Sort all items (both message and files) by sequence number
                const sortedItems = fileSequence
                    .sort((a, b) => a.sequence_no - b.sequence_no);
                
                console.log(`Sorted items:`, sortedItems);
                
                for (const seqItem of sortedItems) {
                    try {
                        if (seqItem.file_type === 'message') {
                            // Send the message text only if not using template as caption
                            if (options.use_template_as_caption && validFilePaths.length > 0) {
                                console.log(`Skipping message in sequence ${seqItem.sequence_no} - will use as caption for files`);
                            } else {
                                console.log(`Sending message (sequence ${seqItem.sequence_no}): "${finalMessage}"`);
                                const messageSent = await this.sendMessageWithRetry(formattedNumber, finalMessage);
                                if (!messageSent) {
                                    console.error(`Failed to send message in sequence ${seqItem.sequence_no}`);
                                } else {
                                    console.log(`Message sent successfully in sequence ${seqItem.sequence_no}`);
                                }
                            }
                        } else if (seqItem.file_type === 'file') {
                            // Find and send the corresponding file
                            const filePath = validFilePaths.find(fp => 
                                path.basename(fp) === seqItem.file_name
                            );
                            
                            if (filePath) {
                                console.log(`Sending file (sequence ${seqItem.sequence_no}): ${seqItem.file_name}`);
                                const media = MessageMedia.fromFilePath(filePath);
                                
                                // Check if we should use template as caption
                                if (options.use_template_as_caption && message && message.trim()) {
                                    console.log(`Using template message as caption for file: ${seqItem.file_name}`);
                                    await this.authClient.client.sendMessage(formattedNumber, media, { caption: message });
                                } else {
                                    await this.authClient.client.sendMessage(formattedNumber, media);
                                }
                            } else {
                                console.warn(`File not found for sequence ${seqItem.sequence_no}: ${seqItem.file_name}`);
                            }
                        }
                        
                        // Add delay between items
                        await new Promise(resolve => setTimeout(resolve, perFileDelayMs));
                    } catch (error) {
                        console.error(`Error sending item (sequence ${seqItem.sequence_no}):`, error);
                    }
                }
            } else {
                // Fallback: send message first, then all files (original behavior)
                console.log(`Sending message first, then ${validFilePaths.length} files for ${contactName}`);
                
                if (validFilePaths.length > 0) {
                    for (const filePath of validFilePaths) {
                        try {
                            const media = MessageMedia.fromFilePath(filePath);
                            
                            // Check if we should use template as caption
                            if (options.use_template_as_caption && message && message.trim()) {
                                console.log(`Using template message as caption for file: ${path.basename(filePath)}`);
                                await this.authClient.client.sendMessage(formattedNumber, media, { caption: message });
                            } else {
                                await this.authClient.client.sendMessage(formattedNumber, media);
                            }
                            
                            console.log(`File sent: ${path.basename(filePath)}`);
                            
                            await new Promise(resolve => setTimeout(resolve, perFileDelayMs));
                        } catch (error) {
                            console.error(`Error sending file ${filePath}:`, error);
                        }
                    }
                }
            }

            console.log(`Successfully sent message to ${contactName} on phone number ${formattedNumber} with ${validFilePaths.length} attachments`);
            return true;

        } catch (error) {
            console.error(`Error sending WhatsApp message to ${contactName}:`, error);
            return false;
        }
    }

    async sendBulkMessages(contacts, message, filePaths = [], fileSequence = [], processName = 'salary_slip', options = {}) {
        const results = [];
        const perContactDelayMs = Number(options.perContactDelayMs || 3000);
        
        for (const contact of contacts) {
            const contactOptions = {
                ...options,
                variables: {
                    ...options.variables,
                    contact_name: contact.name
                }
            };
            
            const result = await this.sendWhatsAppMessage(
                contact.name,
                message,
                filePaths,
                fileSequence,
                contact.phoneNumber,
                processName,
                contactOptions
            );
            
            results.push({
                name: contact.name,
                phoneNumber: contact.phoneNumber,
                success: result
            });

            await new Promise(resolve => setTimeout(resolve, perContactDelayMs));
        }

        return results;
    }

    async prepareFilePaths(filePaths, userEmail = null, baseOutputDir = null, isUpload = false) {
        try {
            if (!filePaths) return [];

            if (!Array.isArray(filePaths)) {
                filePaths = [filePaths];
            }

            const validPaths = [];
            const seenFilenames = new Set();

            // Get user-specific temp directory
            let tempDir = null;
            if (isUpload && userEmail && baseOutputDir) {
                const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
                tempDir = path.join(baseOutputDir, `${sanitizedEmail}_temp`);
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
            } else if (isUpload && baseOutputDir) {
                // Fallback to base temp directory
                tempDir = path.join(baseOutputDir, 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
            }

            for (const filePath of filePaths) {
                if (isUpload) {
                    if (filePath.filename) {
                        if (tempDir) {
                            const tempPath = path.join(tempDir, filePath.filename);
                            await fs.promises.writeFile(tempPath, filePath.buffer);
                            validPaths.push(tempPath);
                            seenFilenames.add(filePath.filename);
                            console.log(`Saved uploaded file to user temp dir: ${tempPath}`);
                        } else {
                            console.error('No temp directory available for uploaded file');
                        }
                    }
                } else {
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        const filename = path.basename(filePath);
                        if (!seenFilenames.has(filename)) {
                            validPaths.push(filePath);
                            seenFilenames.add(filename);
                            console.log(`Added file: ${filePath}`);
                        } else {
                            console.warn(`Duplicate file found: ${filePath}. Skipping.`);
                        }
                    } else {
                        console.warn(`Invalid or non-existent file: ${filePath}`);
                    }
                }
            }

            console.log(`Prepared ${validPaths.length} valid file paths for user: ${userEmail}`);
            return validPaths;
        } catch (error) {
            console.error('Error preparing file paths:', error);
            return [];
        }
    }

    async waitForWhatsAppStore(maxWaitMs = 30000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every 1 second
        
        console.log(`Waiting for WhatsApp Web Store objects to be available (max ${maxWaitMs/1000}s)...`);
        
        while (Date.now() - startTime < maxWaitMs) {
            try {
                const page = this.authClient.client.pupPage;
                if (!page) {
                    console.log('Page not available, waiting...');
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                    continue;
                }
                
                const storeStatus = await page.evaluate(() => {
                    const storeExists = !!window.Store;
                    const msgExists = !!(window.Store && window.Store.Msg);
                    const chatExists = !!(window.Store && window.Store.Chat);
                    
                    // Test if the actual functions are available and working
                    let getContactWorks = false;
                    let getChatWorks = false;
                    let contactStoreExists = false;
                    let chatStoreExists = false;
                    let contactGetFunctionExists = false;
                    let chatGetFunctionExists = false;
                    
                    try {
                        if (window.Store && window.Store.Contact) {
                            contactStoreExists = true;
                            contactGetFunctionExists = typeof window.Store.Contact.get === 'function';
                            
                            // Test if the function is actually callable (not just defined)
                            if (contactGetFunctionExists) {
                                try {
                                    // Try to call the function with a dummy parameter to see if it's properly initialized
                                    const testResult = window.Store.Contact.get('test@c.us');
                                    getContactWorks = true; // If no error, it's working
                                } catch (e) {
                                    // If it throws an error but it's a WhatsApp-specific error (not undefined), it's working
                                    getContactWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getContact');
                                }
                            }
                        }
                    } catch (e) {
                        getContactWorks = false;
                    }
                    
                    try {
                        if (window.Store && window.Store.Chat) {
                            chatStoreExists = true;
                            chatGetFunctionExists = typeof window.Store.Chat.get === 'function';
                            
                            // Test if the function is actually callable (not just defined)
                            if (chatGetFunctionExists) {
                                try {
                                    // Try to call the function with a dummy parameter to see if it's properly initialized
                                    const testResult = window.Store.Chat.get('test@c.us');
                                    getChatWorks = true; // If no error, it's working
                                } catch (e) {
                                    // If it throws an error but it's a WhatsApp-specific error (not undefined), it's working
                                    getChatWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getChat');
                                }
                            }
                        }
                    } catch (e) {
                        getChatWorks = false;
                    }
                    
                    // Check if WhatsApp Web interface is actually loaded
                    const whatsappLoaded = document.title.includes('WhatsApp') || 
                                         document.body.innerHTML.includes('WhatsApp') ||
                                         !!document.querySelector('[data-testid="chat-list"]') ||
                                         !!document.querySelector('#main');
                    
                    // Get more detailed Store object information
                    let storeDetails = {};
                    try {
                        if (window.Store) {
                            storeDetails = {
                                hasContact: !!window.Store.Contact,
                                hasChat: !!window.Store.Chat,
                                hasMsg: !!window.Store.Msg,
                                contactMethods: window.Store.Contact ? Object.getOwnPropertyNames(window.Store.Contact) : [],
                                chatMethods: window.Store.Chat ? Object.getOwnPropertyNames(window.Store.Chat) : [],
                                storeKeys: Object.getOwnPropertyNames(window.Store),
                                contactGetType: window.Store.Contact ? typeof window.Store.Contact.get : 'undefined',
                                chatGetType: window.Store.Chat ? typeof window.Store.Chat.get : 'undefined'
                            };
                        }
                    } catch (e) {
                        storeDetails = { error: e.message };
                    }
                    
                    return {
                        storeExists,
                        msgExists,
                        chatExists,
                        contactStoreExists,
                        chatStoreExists,
                        contactGetFunctionExists,
                        chatGetFunctionExists,
                        getContactWorks,
                        getChatWorks,
                        whatsappLoaded,
                        storeDetails,
                        allLoaded: storeExists && msgExists && chatExists && getContactWorks && getChatWorks && whatsappLoaded
                    };
                });
                
                if (storeStatus.allLoaded) {
                    const elapsed = Date.now() - startTime;
                    console.log(`✅ WhatsApp Web Store objects are now available after ${elapsed}ms`);
                    return true;
                }
                
                const elapsed = Date.now() - startTime;
                console.log(`Store objects not ready yet (${elapsed}ms): Store=${storeStatus.storeExists}, Msg=${storeStatus.msgExists}, Chat=${storeStatus.chatExists}, ContactStore=${storeStatus.contactStoreExists}, ChatStore=${storeStatus.chatStoreExists}, contactGetFunc=${storeStatus.contactGetFunctionExists}, chatGetFunc=${storeStatus.chatGetFunctionExists}, getContact=${storeStatus.getContactWorks}, getChat=${storeStatus.getChatWorks}, whatsappLoaded=${storeStatus.whatsappLoaded}`);
                console.log(`Store details:`, JSON.stringify(storeStatus.storeDetails, null, 2));
                
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                
            } catch (error) {
                console.warn(`Error checking Store availability: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        
        const totalElapsed = Date.now() - startTime;
        console.warn(`⚠️ Store objects not available after ${totalElapsed}ms, attempting page refresh...`);
        
        // Try to refresh the WhatsApp Web page
        try {
            const page = this.authClient.client.pupPage;
            if (page) {
                console.log('Refreshing WhatsApp Web page...');
                await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
                console.log('Page refreshed, waiting 10 seconds for WhatsApp Web to reload...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                // Check again after refresh with more thorough validation
                const refreshedStatus = await page.evaluate(() => {
                    const storeExists = !!window.Store;
                    const msgExists = !!(window.Store && window.Store.Msg);
                    const chatExists = !!(window.Store && window.Store.Chat);
                    
                    let getContactWorks = false;
                    let getChatWorks = false;
                    
                    try {
                        if (window.Store && window.Store.Contact && typeof window.Store.Contact.get === 'function') {
                            try {
                                const testResult = window.Store.Contact.get('test@c.us');
                                getContactWorks = true;
                            } catch (e) {
                                getContactWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getContact');
                            }
                        }
                    } catch (e) {
                        getContactWorks = false;
                    }
                    
                    try {
                        if (window.Store && window.Store.Chat && typeof window.Store.Chat.get === 'function') {
                            try {
                                const testResult = window.Store.Chat.get('test@c.us');
                                getChatWorks = true;
                            } catch (e) {
                                getChatWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getChat');
                            }
                        }
                    } catch (e) {
                        getChatWorks = false;
                    }
                    
                    return {
                        storeExists,
                        msgExists,
                        chatExists,
                        getContactWorks,
                        getChatWorks,
                        allLoaded: storeExists && msgExists && chatExists && getContactWorks && getChatWorks
                    };
                });
                
                if (refreshedStatus.allLoaded) {
                    console.log('✅ WhatsApp Web Store objects are now available after page refresh');
                    return true;
                } else {
                    console.warn('⚠️ Store objects still not available after page refresh, proceeding anyway');
                }
            }
        } catch (refreshError) {
            console.warn(`Error refreshing page: ${refreshError.message}`);
        }
        
        return false;
    }

    formatPhoneNumber(phoneNumber, processName = null) {
        // Simple phone number formatting - WhatsApp Web handles validation
        let cleaned = phoneNumber.toString().replace(/\D/g, '');
        
        console.log(`Original phone number: "${phoneNumber}" -> Cleaned: "${cleaned}"`);
        console.log(`Process name: "${processName}"`);
        
        // Add country code 91 for specific process types
        if (processName === 'single_processing' || processName === 'batch_processing' || processName === 'salary_slip') {
            // Check if the number already has country code 91
            if (!cleaned.startsWith('91')) {
                cleaned = '91' + cleaned;
                console.log(`Added country code 91 for process "${processName}": "${cleaned}"`);
            } else {
                console.log(`Country code 91 already present for process "${processName}": "${cleaned}"`);
            }
        }
        
        // Basic validation - ITU standard: 4-15 digits (including country code)
        if (!cleaned || cleaned.length < 4 || cleaned.length > 15) {
            console.warn(`Invalid phone number length: ${cleaned} (${cleaned.length} digits)`);
            return null;
        }
        
        console.log(`Final formatted number: ${cleaned}`);
        return cleaned + '@c.us';
    }
}

module.exports = { WhatsAppMessaging };

# Whatsapp Utils

# whatsapp_utils_node.py - Python client for Node.js WhatsApp service
import requests
import logging
import os
import json
from typing import List, Dict, Optional, Union
from datetime import datetime
from flask import session

# Configure logging
logging.basicConfig(level=logging.INFO)

class WhatsAppNodeClient:
    """Client to interact with Node.js WhatsApp service"""
    
    def __init__(self, node_service_url: str = "http://whatsapp.bajajearths.com", user_email: str = None):
        self.base_url = node_service_url.rstrip('/')
        self.timeout = 3600  # 1 hour timeout for WhatsApp operations (QR scanning, login, etc.)
        # Use provided user_email or fall back to session
        self.user_email = get_user_email_from_session(user_email)
        
        # Log the initialization with more detail
        if self.user_email:
            logging.info(f"WhatsApp client initialized for user: {self.user_email}")
            # Log session details for debugging
            try:
                from flask import session
                session_user = session.get('user', {})
                logging.debug(f"Session user data: id={session_user.get('id')}, email={session_user.get('email')}")
            except:
                pass
        else:
            logging.warning("WhatsApp client initialized without user email - some features may not work properly")
    
    def check_service_health(self) -> bool:
        """Check if WhatsApp service is running and ready"""
        try:
            logging.info(f"Checking WhatsApp service health at: {self.base_url}/health")
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.get(f"{self.base_url}/health", headers=headers, timeout=self.timeout)
            logging.info(f"Health check response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logging.info(f"Health check response data: {data}")
                whatsapp_ready = data.get('whatsappReady', False)
                whatsapp_initialized = data.get('whatsappInitialized', False)
                has_qr = data.get('hasQR', False)
                
                logging.info(f"Service status - Ready: {whatsapp_ready}, Initialized: {whatsapp_initialized}, Has QR: {has_qr}")
                
                if not whatsapp_ready:
                    if not whatsapp_initialized:
                        logging.error("WhatsApp service is not initialized. User needs to scan QR code first.")
                    elif has_qr:
                        logging.error("QR code is available but not yet scanned. User needs to scan the QR code.")
                    else:
                        logging.error("WhatsApp service is not ready. Make sure to authenticate first through the UI.")
                    
                    # Additional debug info
                    if self.user_email:
                        logging.info(f"Checking status for user: {self.user_email}")
                    else:
                        logging.error("No user email provided. Make sure to pass the user's email when creating the client.")
                        
                return whatsapp_ready
            else:
                logging.error(f"Health check failed with status {response.status_code}: {response.text}")
                return False
        except requests.exceptions.ConnectionError as e:
            logging.error(f"Connection error to WhatsApp service: {e}")
            logging.error("This usually means the service is not running on port 7093")
            return False
        except requests.exceptions.Timeout as e:
            logging.error(f"Timeout error connecting to WhatsApp service: {e}")
            return False
        except requests.exceptions.RequestException as e:
            logging.error(f"Request error to WhatsApp service: {e}")
            return False
        except Exception as e:
            logging.error(f"Unexpected error checking WhatsApp service health: {e}")
            logging.error(f"Error type: {type(e)}")
            return False

    def get_status(self) -> Dict:
        """Get WhatsApp status from Node service"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            # Use /auth-status endpoint to get full authentication status including user info
            response = requests.get(f"{self.base_url}/auth-status", headers=headers, timeout=self.timeout)
            if response.status_code == 200:
                data = response.json()
                # Convert the response to match the expected format
                return {
                    "isReady": data.get("authenticated", False),
                    "status": "ready" if data.get("authenticated", False) else "initializing",
                    "authenticated": data.get("authenticated", False),
                    "userInfo": data.get("userInfo")
                }
            return {"isReady": False, "status": "unavailable", "authenticated": False, "userInfo": None}
        except Exception as e:
            logging.error(f"Error getting WhatsApp status: {e}")
            return {"isReady": False, "status": "error", "authenticated": False, "userInfo": None}

    def get_qr(self) -> Dict:
        """Get current QR code (if any) from Node service"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.get(f"{self.base_url}/qr", headers=headers, timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
            return {"qr": ""}
        except Exception as e:
            logging.error(f"Error getting WhatsApp QR: {e}")
            return {"qr": ""}

    def trigger_login(self) -> Dict:
        """Trigger login flow on Node service (refresh QR)"""
        try:
            headers = {'X-User-Email': self.user_email, 'Content-Type': 'application/json'} if self.user_email else {'Content-Type': 'application/json'}
            data = {'email': self.user_email} if self.user_email else {}
            response = requests.post(f"{self.base_url}/trigger-login", headers=headers, json=data, timeout=self.timeout)
            
            if response.status_code == 200:
                result = response.json()
                if not result.get('authenticated'):
                    # Add special flag for frontend to show QR modal
                    result['requiresQRScan'] = True
                    result['userEmail'] = self.user_email
                    # Log that QR scan needed
                    logging.info(f"WhatsApp authentication required for {self.user_email}. QR scan needed.")
                return result
                
            logging.error(f"Trigger login failed: {response.status_code} - {response.text}")
            return {"qr": "", "requiresQRScan": True, "userEmail": self.user_email}
        except Exception as e:
            logging.error(f"Error triggering WhatsApp login: {e}")
            return {"qr": "", "requiresQRScan": True, "userEmail": self.user_email}

    def logout(self) -> bool:
        """Logout current WhatsApp session on Node service"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(f"{self.base_url}/logout", headers=headers, timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            logging.error(f"Error logging out WhatsApp: {e}")
            return False

    def force_new_session(self) -> bool:
        """Force a new WhatsApp session by clearing existing session"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(f"{self.base_url}/force-new-session", headers=headers, timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            logging.error(f"Error forcing new WhatsApp session: {e}")
            return False
    
    def wait_for_service(self, max_attempts: int = 30, interval: int = 5) -> bool:
        """Wait for WhatsApp service to be ready"""
        import time
        
        for attempt in range(max_attempts):
            if self.check_service_health():
                logging.info("WhatsApp service is ready")
                return True
            logging.info(f"Waiting for WhatsApp service... Attempt {attempt + 1}/{max_attempts}")
            time.sleep(interval)
        
        logging.error("WhatsApp service failed to become ready")
        return False
    
    def has_user_email(self) -> bool:
        """Check if this client has a valid user email"""
        return has_user_email(self.user_email)

    def send_message(self, 
                    contact_name: str, 
                    whatsapp_number: str,
                    process_name: str = "salary_slip",
                    message: str = "",
                    file_paths: List[str] = None,
                    file_sequence: List[Dict] = None,
                    variables: Dict = None,
                    options: Dict = None) -> Union[bool, str]:
        try:
            # Validate that we have a user email
            if not self.has_user_email():
                logging.error("No user email available for WhatsApp message. Please ensure user is logged in.")
                return "USER_NOT_LOGGED_IN"
            
            # Check if service is ready
            if not self.check_service_health():
                logging.error("WhatsApp service is not ready")
                return "WHATSAPP_SERVICE_NOT_READY"
            
            # Prepare file paths
            if file_paths is None:
                file_paths = []
            elif isinstance(file_paths, str):
                file_paths = [file_paths]
            
            # Prepare file sequence
            if file_sequence is None:
                file_sequence = []
            
            # Prepare variables
            if variables is None:
                variables = {}
            
            # Prepare options
            if options is None:
                options = {}
            
            # Prepare request data
            data = {
                'contact_name': contact_name,
                'whatsapp_number': whatsapp_number,
                'process_name': process_name,
                'message': message,
                'file_sequence': json.dumps(file_sequence),
                'variables': json.dumps(variables),
                'options': json.dumps(options)
            }
            
            # Prepare files for upload - deduplicate file paths
            files = []
            seen_files = set()  # Track unique file paths to prevent duplicates
            if file_paths:
                for file_path in file_paths:
                    # Normalize the file path to handle different representations of the same file
                    normalized_path = os.path.abspath(file_path)
                    if normalized_path not in seen_files:
                        seen_files.add(normalized_path)
                        if os.path.exists(file_path):
                            files.append(('files', open(file_path, 'rb')))
                            logging.info(f"Added file for upload: {file_path}")
                        else:
                            logging.warning(f"File not found: {file_path}")
                    else:
                        logging.info(f"Skipping duplicate file: {file_path}")
            
            logging.info(f"Sending WhatsApp message to {contact_name} ({whatsapp_number}) with process: {process_name}")
            
            # Send request with email header
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(
                f"{self.base_url}/send-message",
                headers=headers,
                data=data,
                files=files,
                timeout=self.timeout
            )
            
            # Close file handles
            for _, file_handle in files:
                file_handle.close()
            
            if response.status_code == 200:
                result = response.json()
                success = bool(result.get('success', False))
                
                # Check for detailed error information in the response
                if not success:
                    error_message = result.get('error', 'Unknown error')
                    error_details = result.get('details', '')
                    logging.error(f"WhatsApp message failed to {contact_name} on {whatsapp_number}: {error_message}")
                    if error_details:
                        logging.error(f"Error details: {error_details}")
                    return "WHATSAPP_SEND_ERROR"
                else:
                    logging.info(f"WhatsApp message sent successfully to {contact_name} on {whatsapp_number}")
                    return success
            else:
                logging.error(f"Error sending WhatsApp message: {response.status_code} - {response.text}")
                return "WHATSAPP_API_ERROR"
                
        except requests.exceptions.ConnectionError as e:
            logging.error(f"Connection error to WhatsApp service: {e}")
            return "WHATSAPP_CONNECTION_ERROR"
        except requests.exceptions.Timeout as e:
            logging.error(f"Timeout error connecting to WhatsApp service: {e}")
            return "WHATSAPP_TIMEOUT_ERROR"
        except Exception as e:
            logging.error(f"Error sending WhatsApp message to {contact_name}: {str(e)}")
            return "WHATSAPP_SEND_ERROR"

    def send_bulk_messages(self, 
                          contacts: List[Dict], 
                          process_name: str = "salary_slip",
                          message: str = "",
                          file_paths: List[str] = None,
                          variables: Dict = None,
                          options: Dict = None) -> List[Dict]:

        try:
            # Validate that we have a user email
            if not self.has_user_email():
                logging.error("No user email available for bulk WhatsApp messages. Please ensure user is logged in.")
                return []
            
            # Check if service is ready
            if not self.check_service_health():
                logging.error("WhatsApp service is not ready")
                return []
            
            # Prepare file paths
            if file_paths is None:
                file_paths = []
            
            # Prepare variables
            if variables is None:
                variables = {}
            
            # Prepare options
            if options is None:
                options = {}
            
            # Prepare request data
            data = {
                'contacts': json.dumps(contacts),
                'process_name': process_name,
                'message': message,
                'variables': json.dumps(variables),
                'options': json.dumps(options)
            }
            
            # Prepare files for upload - deduplicate file paths
            files = []
            seen_files = set()  # Track unique file paths to prevent duplicates
            for file_path in file_paths:
                # Normalize the file path to handle different representations of the same file
                normalized_path = os.path.abspath(file_path)
                if normalized_path not in seen_files:
                    seen_files.add(normalized_path)
                    if os.path.exists(file_path):
                        files.append(('files', open(file_path, 'rb')))
                        logging.info(f"Added file for bulk upload: {file_path}")
                    else:
                        logging.warning(f"File not found: {file_path}")
                else:
                    logging.info(f"Skipping duplicate file in bulk upload: {file_path}")
            
            logging.info(f"Sending bulk WhatsApp messages to {len(contacts)} contacts with process: {process_name}")
            
            # Send request with email header
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(
                f"{self.base_url}/send-bulk",
                headers=headers,
                data=data,
                files=files,
                timeout=self.timeout * max(len(contacts), 1)  # Longer timeout for bulk, minimum 60s
            )
            
            # Close file handles
            for _, file_handle in files:
                file_handle.close()
            
            if response.status_code == 200:
                result = response.json()
                successful = result.get('successful', 0)
                total_processed = result.get('total_processed', 0)
                logging.info(f"Bulk WhatsApp messages processed: {successful}/{total_processed} successful")
                
                # Check if there were any failures
                if successful < total_processed:
                    failed_count = total_processed - successful
                    logging.warning(f"Bulk WhatsApp messages: {failed_count} messages failed out of {total_processed}")
                
                return result.get('results', [])
            else:
                logging.error(f"Error sending bulk WhatsApp messages: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            logging.error(f"Error sending bulk WhatsApp messages: {str(e)}")
            return []


# Legacy function wrappers for backward compatibility
def send_whatsapp_message(contact_name: str, message: Union[str, List[str]], 
                         file_paths: Union[str, List[str]] = None, 
                         file_sequence: List[Dict] = None,
                         whatsapp_number: str = "", 
                         process_name: str = "salary_slip",
                         options: Optional[Dict] = None,
                         user_email: str = None) -> Union[bool, str]:
    """
    Legacy wrapper for the unified send_message function
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Convert message to string if it's a list
    if isinstance(message, list):
        message_text = '\n'.join(message)
    else:
        message_text = message or ""
    
    # Convert file_paths to list if it's a string
    if isinstance(file_paths, str):
        file_paths = [file_paths]
    elif file_paths is None:
        file_paths = []
    
    # Extract variables from options
    variables = options.get('variables', {}) if options else {}
    
    return client.send_message(
        contact_name=contact_name,
        whatsapp_number=whatsapp_number,
        process_name=process_name,
        message=message_text,
        file_paths=file_paths,
        file_sequence=file_sequence,
        variables=variables,
        options=options
    )


def send_bulk_whatsapp_messages(contacts: List[Dict], message: Union[str, List[str]], 
                               file_paths: List[str] = None, 
                               process_name: str = "salary_slip",
                               user_email: str = None) -> List[Dict]:
    """
    Legacy wrapper for the unified send_bulk_messages function
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Convert message to string if it's a list
    if isinstance(message, list):
        message_text = '\n'.join(message)
    else:
        message_text = message or ""
    
    return client.send_bulk_messages(
        contacts=contacts,
        process_name=process_name,
        message=message_text,
        file_paths=file_paths,
        variables={},
        options={}
    )


def handle_reactor_report_notification_with_stats(recipients_data, input_date, file_path, sheets_processed, user_email: str = None):
    """
    Enhanced function for reactor report notifications with delivery statistics tracking
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Initialize delivery statistics
    delivery_stats = {
        "total_recipients": 0,
        "successful_deliveries": 0,
        "failed_deliveries": 0,
        "failed_contacts": []
    }
    
    # Validate that we have a user email
    if not client.has_user_email():
        logging.error("No user email available for reactor report notification. Please ensure user is logged in.")
        return {
            "success": False,
            "error": "USER_NOT_LOGGED_IN",
            "delivery_stats": delivery_stats
        }
    
    # Check if service is ready
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return {
            "success": False,
            "error": "WHATSAPP_SERVICE_NOT_READY",
            "delivery_stats": delivery_stats
        }
    
    try:
        # Parse recipients from recipients_data
        if not recipients_data or len(recipients_data) < 2:
            logging.error("No recipients data provided for reactor report")
            return {
                "success": False,
                "error": "NO_RECIPIENTS_DATA",
                "delivery_stats": delivery_stats
            }
        
        headers = [h.strip() for h in recipients_data[0]]
        logging.info(f"Available headers: {headers}")
        
        # Look for various possible column names
        name_idx = None
        phone_idx = None
        whatsapp_idx = None
        country_code_idx = None
        
        # Try different possible column names
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if 'name' in header_lower:
                name_idx = i
            elif 'phone' in header_lower or 'contact' in header_lower or 'mobile' in header_lower:
                phone_idx = i
            elif 'whatsapp' in header_lower:
                whatsapp_idx = i
            elif 'country code' in header_lower or 'countrycode' in header_lower.replace(' ', ''):
                country_code_idx = i
        
        logging.info(f"Recipients headers found: Name={name_idx}, Phone={phone_idx}, WhatsApp={whatsapp_idx}, Country Code={country_code_idx}")
        
        # Check if we have the required columns
        has_phone_contact = (phone_idx is not None) or (whatsapp_idx is not None)
        has_separate_phone_components = (phone_idx is not None) and (country_code_idx is not None)
        
        if name_idx is None or (not has_phone_contact and not has_separate_phone_components):
            logging.error("Required columns for WhatsApp notifications not found in recipients data")
            logging.error(f"Available headers: {headers}")
            return {
                "success": False,
                "error": "MISSING_REQUIRED_COLUMNS",
                "delivery_stats": delivery_stats
            }
        
        success_count = 0
        total_recipients = 0
        
        for row in recipients_data[1:]:
            try:
                # Calculate the maximum index we need to check
                max_indices = [name_idx]
                if phone_idx is not None:
                    max_indices.append(phone_idx)
                if whatsapp_idx is not None:
                    max_indices.append(whatsapp_idx)
                if country_code_idx is not None:
                    max_indices.append(country_code_idx)
                
                if len(row) <= max(max_indices):
                    continue
                    
                recipient_name = row[name_idx].strip()
                phone_number = row[phone_idx].strip() if phone_idx is not None else ''
                whatsapp_number = row[whatsapp_idx].strip() if whatsapp_idx is not None else ''
                country_code = row[country_code_idx].strip() if country_code_idx is not None else ''
                
                # Determine the contact number based on available data
                contact_number = None
                failure_reason = None
                
                if whatsapp_number:
                    # Use WhatsApp number if available
                    contact_number = whatsapp_number
                    logging.info(f"Using WhatsApp number for {recipient_name}: {contact_number}")
                elif phone_number and country_code:
                    # Combine country code and phone number
                    contact_number = f"{country_code}{phone_number}".replace(' ', '')
                    logging.info(f"Combining country code and phone for {recipient_name}: Country Code '{country_code}' + Phone '{phone_number}' = '{contact_number}'")
                elif phone_number:
                    # Use phone number as-is if no country code
                    contact_number = phone_number
                    logging.info(f"Using phone number for {recipient_name}: {contact_number}")
                else:
                    failure_reason = "Missing contact number"
                
                logging.info(f"Processing recipient: {recipient_name}, Final Contact: {contact_number}")
                
                if recipient_name and contact_number:
                    # Validate phone number format for reactor reports
                    contact_cleaned = contact_number.replace(' ', '').replace('-', '').replace('+', '')
                    
                    # Check if the contact number has proper format (minimum 4 digits as per ITU standard)
                    if len(contact_cleaned) < 4:
                        failure_reason = f"Invalid phone number format - too short ({len(contact_cleaned)} digits)"
                        logging.warning(f"Skipping WhatsApp message for {recipient_name}: {failure_reason}")
                    elif len(contact_cleaned) > 15:
                        failure_reason = f"Invalid phone number format - too long ({len(contact_cleaned)} digits)"
                        logging.warning(f"Skipping WhatsApp message for {recipient_name}: {failure_reason}")
                    else:
                        logging.info(f"Valid phone number for {recipient_name}: {contact_number} -> Cleaned: {contact_cleaned}")
                        total_recipients += 1
                        
                        # Send WhatsApp message using unified function
                        success = client.send_message(
                            contact_name=recipient_name,
                            whatsapp_number=contact_number,
                            process_name="reactor_report",
                            file_paths=[file_path],
                            variables={
                                "input_date": input_date,
                                "sheets_processed": sheets_processed
                            },
                            options={}
                        )
                        
                        if success is True:
                            success_count += 1
                            logging.info(f"Reactor report WhatsApp message sent successfully to {recipient_name}")
                        else:
                            failure_reason = f"WhatsApp send failed: {success}"
                            logging.error(f"Failed to send reactor report WhatsApp message to {recipient_name}: {success}")
                else:
                    failure_reason = "Missing contact number or name"
                    logging.warning(f"Skipping WhatsApp notification for {recipient_name}: {failure_reason}")
                
                # Track failed deliveries
                if failure_reason:
                    delivery_stats["failed_deliveries"] += 1
                    delivery_stats["failed_contacts"].append({
                        "name": recipient_name,
                        "contact": contact_number if contact_number else "N/A",
                        "reason": failure_reason
                    })
                else:
                    delivery_stats["successful_deliveries"] += 1
                    
            except Exception as e:
                logging.error(f"Error sending reactor report WhatsApp notification to {recipient_name if 'recipient_name' in locals() else 'unknown'}: {e}")
                delivery_stats["failed_deliveries"] += 1
                delivery_stats["failed_contacts"].append({
                    "name": recipient_name if 'recipient_name' in locals() else 'unknown',
                    "contact": contact_number if 'contact_number' in locals() else "N/A",
                    "reason": f"Exception: {str(e)}"
                })
                continue
        
        # Update total recipients
        delivery_stats["total_recipients"] = total_recipients
        
        logging.info(f"Reactor report WhatsApp notifications: {success_count}/{total_recipients} successful")
        
        return {
            "success": success_count > 0,
            "delivery_stats": delivery_stats
        }
        
    except Exception as e:
        logging.error(f"Error processing reactor report WhatsApp notifications: {e}")
        return {
            "success": False,
            "error": "REACTOR_NOTIFICATION_ERROR",
            "delivery_stats": delivery_stats
        }


def handle_reactor_report_notification(recipients_data, input_date, file_path, sheets_processed, user_email: str = None):
    """
    Legacy function for reactor report notifications - now uses unified approach
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Validate that we have a user email
    if not client.has_user_email():
        logging.error("No user email available for reactor report notification. Please ensure user is logged in.")
        return "USER_NOT_LOGGED_IN"
    
    # Check if service is ready
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return "WHATSAPP_SERVICE_NOT_READY"
    
    try:
        # Parse recipients from recipients_data
        if not recipients_data or len(recipients_data) < 2:
            logging.error("No recipients data provided for reactor report")
            return "NO_RECIPIENTS_DATA"
        
        headers = [h.strip() for h in recipients_data[0]]
        logging.info(f"Available headers: {headers}")
        
        # Look for various possible column names
        name_idx = None
        phone_idx = None
        whatsapp_idx = None
        country_code_idx = None
        
        # Try different possible column names
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if 'name' in header_lower:
                name_idx = i
            elif 'phone' in header_lower or 'contact' in header_lower or 'mobile' in header_lower:
                phone_idx = i
            elif 'whatsapp' in header_lower:
                whatsapp_idx = i
            elif 'country code' in header_lower or 'countrycode' in header_lower.replace(' ', ''):
                country_code_idx = i
        
        logging.info(f"Recipients headers found: Name={name_idx}, Phone={phone_idx}, WhatsApp={whatsapp_idx}, Country Code={country_code_idx}")
        
        # Check if we have the required columns
        has_phone_contact = (phone_idx is not None) or (whatsapp_idx is not None)
        has_separate_phone_components = (phone_idx is not None) and (country_code_idx is not None)
        
        if name_idx is None or (not has_phone_contact and not has_separate_phone_components):
            logging.error("Required columns for WhatsApp notifications not found in recipients data")
            logging.error(f"Available headers: {headers}")
            return "MISSING_REQUIRED_COLUMNS"
        
        success_count = 0
        total_recipients = 0
        
        for row in recipients_data[1:]:
            try:
                # Calculate the maximum index we need to check
                max_indices = [name_idx]
                if phone_idx is not None:
                    max_indices.append(phone_idx)
                if whatsapp_idx is not None:
                    max_indices.append(whatsapp_idx)
                if country_code_idx is not None:
                    max_indices.append(country_code_idx)
                
                if len(row) <= max(max_indices):
                    continue
                    
                recipient_name = row[name_idx].strip()
                phone_number = row[phone_idx].strip() if phone_idx is not None else ''
                whatsapp_number = row[whatsapp_idx].strip() if whatsapp_idx is not None else ''
                country_code = row[country_code_idx].strip() if country_code_idx is not None else ''
                
                # Determine the contact number based on available data
                contact_number = None
                
                if whatsapp_number:
                    # Use WhatsApp number if available
                    contact_number = whatsapp_number
                    logging.info(f"Using WhatsApp number for {recipient_name}: {contact_number}")
                elif phone_number and country_code:
                    # Combine country code and phone number
                    contact_number = f"{country_code}{phone_number}".replace(' ', '')
                    logging.info(f"Combining country code and phone for {recipient_name}: Country Code '{country_code}' + Phone '{phone_number}' = '{contact_number}'")
                elif phone_number:
                    # Use phone number as-is if no country code
                    contact_number = phone_number
                    logging.info(f"Using phone number for {recipient_name}: {contact_number}")
                
                logging.info(f"Processing recipient: {recipient_name}, Final Contact: {contact_number}")
                
                if recipient_name and contact_number:
                    # Validate phone number format for reactor reports
                    # Extract country code and phone number from the contact
                    contact_cleaned = contact_number.replace(' ', '').replace('-', '').replace('+', '')
                    
                    # Check if the contact number has proper format (minimum 4 digits as per ITU standard)
                    if len(contact_cleaned) < 4:
                        logging.warning(f"Skipping WhatsApp message for {recipient_name}: Invalid phone number format - too short ({len(contact_cleaned)} digits)")
                        continue
                    
                    if len(contact_cleaned) > 15:
                        logging.warning(f"Skipping WhatsApp message for {recipient_name}: Invalid phone number format - too long ({len(contact_cleaned)} digits)")
                        continue
                    
                    logging.info(f"Valid phone number for {recipient_name}: {contact_number} -> Cleaned: {contact_cleaned}")
                    total_recipients += 1
                    
                    # Send WhatsApp message using unified function
                    success = client.send_message(
                        contact_name=recipient_name,
                        whatsapp_number=contact_number,
                        process_name="reactor_report",
                        file_paths=[file_path],
                        variables={
                            "input_date": input_date,
                            "sheets_processed": sheets_processed
                        },
                        options={}
                    )
                    
                    if success is True:
                        success_count += 1
                        logging.info(f"Reactor report WhatsApp message sent successfully to {recipient_name}")
                    else:
                        logging.error(f"Failed to send reactor report WhatsApp message to {recipient_name}: {success}")
                else:
                    logging.warning(f"Skipping WhatsApp notification for {recipient_name}: Missing contact number or name")
            except Exception as e:
                logging.error(f"Error sending reactor report WhatsApp notification to {recipient_name if 'recipient_name' in locals() else 'unknown'}: {e}")
                continue
        
        logging.info(f"Reactor report WhatsApp notifications: {success_count}/{total_recipients} successful")
        if success_count > 0:
            return True
        else:
            return "NO_SUCCESSFUL_NOTIFICATIONS"
        
    except Exception as e:
        logging.error(f"Error processing reactor report WhatsApp notifications: {e}")
        return "REACTOR_NOTIFICATION_ERROR"


def get_employee_contact(employee_name: str, contact_employees: List[Dict]) -> str:
    """Get employee contact number from contact data - matches original Python function"""
    try:
        if not isinstance(contact_employees, list):
            logging.error("Error: contact_employees is not a list of dictionaries.")
            return ""
            
        for record in contact_employees:
            if isinstance(record, dict) and record.get("Name") == employee_name:
                contact = str(record.get("Contact No.", ""))
                if contact:
                    logging.info(f"Found contact for {employee_name}: {contact}")
                else:
                    logging.warning(f"No contact found for {employee_name}")
                return contact
                
        logging.warning(f"No contact record found for {employee_name}")
        return ""
    except Exception as e:
        logging.error(f"Error getting contact for {employee_name}: {str(e)}")
        return ""


def prepare_file_paths(file_paths, user_email=None, base_output_dir=None, is_upload=False):
    """
    Prepare file paths for processing with user-specific temporary directories.
    Maintains backward compatibility with temp_dir parameter.
    
    Args:
        file_paths: List of file paths or uploaded file objects
        user_email: User's email address for user-specific temp directory
        base_output_dir: Base output directory path
        is_upload: Boolean indicating if files are uploaded (need to be saved)
        
    Returns:
        list: List of valid file paths ready for processing
    """
    try:
        # Import temp_manager here to avoid circular imports
        from .temp_manager import get_user_temp_dir
        
        if not file_paths:
            return []
            
        if not isinstance(file_paths, list):
            file_paths = [file_paths]
            
        valid_paths = []
        seen_filenames = set()

        def _remove_numeric_prefix(filename: str) -> str:
            """Remove a leading long numeric prefix followed by '-' from filename.
            Example: '1755776006074-reactor_report_2025-08-02.pdf' -> 'reactor_report_2025-08-02.pdf'
            Keeps the original name otherwise.
            """
            try:
                base_name = os.path.basename(filename)
                parts = base_name.split('-', 1)
                if len(parts) == 2 and parts[0].isdigit() and len(parts[0]) >= 10:
                    return parts[1]
                return base_name
            except Exception:
                return os.path.basename(filename)
        
        # Get user-specific temp directory
        temp_dir = None
        if is_upload and user_email and base_output_dir:
            temp_dir = get_user_temp_dir(user_email, base_output_dir)
        elif is_upload and not user_email and base_output_dir:
            # Fallback to base temp directory if no user email provided
            temp_dir = os.path.join(base_output_dir, "temp")
            os.makedirs(temp_dir, exist_ok=True)
        
        for path in file_paths:
            if is_upload:
                if hasattr(path, 'filename') and path.filename:
                    # Normalize and clean the filename to avoid unwanted numeric prefixes
                    original_filename = os.path.basename(path.filename)
                    cleaned_filename = _remove_numeric_prefix(original_filename)
                    
                    if temp_dir:
                        temp_path = os.path.join(temp_dir, cleaned_filename)
                        path.save(temp_path)
                        valid_paths.append(temp_path)
                        seen_filenames.add(cleaned_filename)
                        logging.info(f"Saved attachment file as '{cleaned_filename}' (original: '{original_filename}') to user temp dir: {temp_path}")
                    else:
                        logging.error("No temp directory available for uploaded file")
            else:
                if os.path.exists(path) and os.path.isfile(path):
                    filename = os.path.basename(path)
                    if filename not in seen_filenames:
                        valid_paths.append(path)
                        seen_filenames.add(filename)
                        logging.info(f"Added file: {path}")
                    else:
                        logging.warning(f"Duplicate file found: {path}. Skipping.")
                else:
                    logging.warning(f"Invalid or non-existent file path: {path}")
                
        logging.info(f"Prepared {len(valid_paths)} valid file paths for user: {user_email}")
        return valid_paths
    except Exception as e:
        logging.error(f"Error preparing file paths: {str(e)}")
        return []


# Configuration
WHATSAPP_NODE_SERVICE_URL = os.getenv('WHATSAPP_NODE_SERVICE_URL', 'https://whatsapp.bajajearths.com')

def get_user_email_from_session(user_email: str = None) -> str:
    """
    Get user email from parameter or fall back to session.
    This function can be used by other modules to get the current user's email.
    """
    if user_email:
        return user_email
    try:
        session_email = session.get('user', {}).get('email') or session.get('user', {}).get('id')
        if session_email:
            logging.info(f"Retrieved user identifier from session: {session_email}")
            logging.debug(f"Session contains: email={session.get('user', {}).get('email')}, id={session.get('user', {}).get('id')}")
        else:
            logging.warning("No user email found in session")
        return session_email
    except Exception as e:
        logging.warning(f"Could not get user email from session: {e}")
        return None

def has_user_email(user_email: str = None) -> bool:
    """
    Check if a user email is available (either provided or in session).
    """
    email = get_user_email_from_session(user_email)
    return email is not None and email.strip() != ""

def initialize_whatsapp_client(user_email: str = None) -> bool:
    """
    Initialize WhatsApp client for a specific user and ensure they're authenticated.
    Returns True if the client is ready to use.
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Validate that we have a user email
    if not client.has_user_email():
        logging.error("No user email available for WhatsApp client initialization. Please ensure user is logged in.")
        return False
    
    # First check if already authenticated
    try:
        if client.check_service_health():
            logging.info(f"WhatsApp client already initialized and ready for user: {client.user_email}")
            return True
            
        # If not ready, try to trigger login to get QR code
        login_result = client.trigger_login()
        
        if login_result.get('authenticated'):
            logging.info(f"WhatsApp client authenticated for user: {client.user_email}")
            return True
        elif login_result.get('qr'):
            logging.info(f"QR code generated for user: {client.user_email}. User needs to scan QR code.")
            return False
        else:
            logging.error(f"Failed to initialize WhatsApp client for user: {client.user_email}")
            return False
    except Exception as e:
        logging.error(f"Error initializing WhatsApp client for user {client.user_email}: {str(e)}")
        return False

# Initialize client
whatsapp_client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL)