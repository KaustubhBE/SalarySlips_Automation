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
                        // Removed '--disable-sync' - allows WhatsApp Web to sync Store objects (messages, chats, contacts)
                        '--disable-translate',
                        // Removed '--disable-background-networking' - CRITICAL: This was preventing WhatsApp Web from syncing Store objects from server
                        // Removed '--disable-component-extensions-with-background-pages' - allows background processes needed for syncing
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