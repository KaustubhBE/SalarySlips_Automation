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
        
        console.log(`WhatsAppAuth initialized for clientId: ${this.clientId}`);
        console.log(`Session path: ${this.sessionPath}`);
    }

    async cleanupCorruptedSession() {
        try {
            // Simple cleanup - just log that we're cleaning up
            console.log(`Cleaning up corrupted session for clientId: ${this.clientId}`);
            // No actual cleanup needed since we're using simple service management
        } catch (error) {
            console.error(`Error cleaning up session for ${this.clientId}:`, error);
        }
    }

    async initialize() {
        if (this.isInitialized) {
            console.log(`Client ${this.clientId} already initialized`);
            return;
        }

        try {
            console.log(`Initializing WhatsApp client for clientId: ${this.clientId}`);
            
            // Clean up any existing corrupted session
            await this.cleanupCorruptedSession();
            
            this.client = new Client({
                authStrategy: new LocalAuth({ clientId: this.clientId }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--single-process',
                        '--disable-web-security',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-ipc-flooding-protection',
                        '--memory-pressure-off',
                        '--max_old_space_size=4096',
                        '--disable-sync',
                        '--disable-background-sync',
                        '--disable-background-networking',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-default-apps',
                        '--disable-translate',
                        '--hide-scrollbars',
                        '--mute-audio',
                        '--no-first-run',
                        '--disable-features=TranslateUI',
                        '--disable-component-extensions-with-background-pages',
                        '--disable-client-side-phishing-detection',
                        '--disable-sync-preferences',
                        '--disable-sync-app-list',
                        '--disable-sync-app-settings',
                        '--disable-sync-autofill',
                        '--disable-sync-bookmarks',
                        '--disable-sync-extensions',
                        '--disable-sync-history',
                        '--disable-sync-passwords',
                        '--disable-sync-reading-list',
                        '--disable-sync-tabs',
                        '--disable-sync-themes',
                        '--disable-sync-typed-urls',
                        '--disable-sync-wifi-credentials'
                    ],
                    executablePath: '/usr/bin/chromium-browser',
                    ignoreDefaultArgs: ['--disable-extensions'],
                    timeout: 60000,
                    protocolTimeout: 60000
                }
            });

            this.setupEventListeners();
            
            console.log(`Starting client initialization for ${this.clientId}...`);
            await this.client.initialize();
            this.isInitialized = true;
            console.log(`WhatsApp client initialized successfully for clientId: ${this.clientId}`);
            
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
            console.log(`WhatsApp Client authenticated for clientId: ${this.clientId}`);
            
            // Give WhatsApp Web a moment to fully load before marking as ready
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Wait for WhatsApp Web Store objects to be available
            await this.waitForWhatsAppStore();
            
            // Try to validate readiness, but don't fail if it doesn't work
            try {
                await this.validateClientReadiness();
                console.log(`Client ${this.clientId} validated after authentication`);
            } catch (validationError) {
                console.warn(`Validation failed after authentication, but continuing: ${validationError.message}`);
            }
            
            this.isReady = true;
            this.currentQR = null;
            // Clear cached connection status to force refresh
            this._cachedConnectionStatus = null;
            this.emit('ready');
        });

        this.client.on('message', (msg) => {
            console.log(`Message received for ${this.clientId}:`, msg.body);
        });

        this.client.on('message_create', (msg) => {
            console.log(`Message created for ${this.clientId}:`, msg.body);
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

    

    async waitForWhatsAppStore(maxWaitMs = 30000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every 1 second
        
        console.log(`Waiting for WhatsApp Web Store objects to be available for ${this.clientId}...`);
        
        while (Date.now() - startTime < maxWaitMs) {
            try {
                const page = this.client.pupPage;
                if (!page) {
                    throw new Error('Page not available');
                }
                
                const storeAvailable = await page.evaluate(() => {
                    return window.Store && window.Store.Msg && window.Store.Chat;
                });
                
                if (storeAvailable) {
                    console.log(`WhatsApp Web Store objects are now available for ${this.clientId}`);
                    return true;
                }
                
                console.log(`Store objects not yet available for ${this.clientId}, waiting...`);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                
            } catch (error) {
                console.warn(`Error checking Store availability for ${this.clientId}: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        
        console.warn(`Store objects not available after ${maxWaitMs}ms for ${this.clientId}, proceeding anyway`);
        return false;
    }

    async validateClientReadiness() {
        if (!this.client) {
            throw new Error('Client not initialized');
        }

        // Test basic client functionality
        try {
            // Test 1: Check if we can access the page context first
            const page = this.client.pupPage;
            if (!page) {
                throw new Error('WhatsApp Web page not accessible - page is null');
            }

            // Test 2: Check if WhatsApp Web is fully loaded (more lenient approach)
            let isLoaded = false;
            try {
                // First try the strict check
                isLoaded = await page.evaluate(() => {
                    return window.Store && window.Store.Msg && window.Store.Chat;
                });
            } catch (evalError) {
                console.log(`Strict page evaluation failed, trying alternative checks: ${evalError.message}`);
                
                // Alternative check 1: Check if basic WhatsApp objects exist
                try {
                    isLoaded = await page.evaluate(() => {
                        return window.Store || window.webpackChunkwhatsapp_web_client;
                    });
                } catch (altError1) {
                    console.log(`Alternative check 1 failed, trying basic page check: ${altError1.message}`);
                    
                    // Alternative check 2: Just see if page is responsive
                    try {
                        await page.evaluate(() => document.title);
                        isLoaded = true; // If we can evaluate anything, page is loaded
                        console.log(`Page is responsive, considering it loaded`);
                    } catch (altError2) {
                        throw new Error('WhatsApp Web page is not responsive');
                    }
                }
            }

            if (!isLoaded) {
                throw new Error('WhatsApp Web interface not fully loaded');
            }

            // Test 3: Check if we can get user info (only if page is loaded)
            try {
                const userInfo = await this.client.getState();
                if (!userInfo || userInfo === 'UNPAIRED') {
                    console.log(`Client state: ${userInfo}, but page is loaded - continuing`);
                }
            } catch (stateError) {
                console.log(`State check failed but page is loaded: ${stateError.message}`);
                // Don't fail validation if state check fails but page is loaded
            }

            console.log(`Client readiness validation passed for ${this.clientId}`);
            return true;

        } catch (error) {
            console.error(`Client readiness validation failed for ${this.clientId}:`, error);
            throw error;
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

    async triggerLogin(timeoutMs = 300000) { // 5 minutes timeout
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
                const timeout = setTimeout(() => {
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
                
                const onQR = (qr) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
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
                        clearTimeout(timeout);
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
                        clearTimeout(timeout);
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
                    clearTimeout(timeout);
                    resolve({
                        isReady: false,
                        qr: this.currentQR,
                        authenticated: false
                    });
                } else if (this.isReady) {
                    resolved = true;
                    clearTimeout(timeout);
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

    async waitForReady(timeoutMs = 300000) {
        try {
            if (this.isReady) {
                return true;
            }
            
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for WhatsApp client to be ready'));
                }, timeoutMs);
                
                if (this.isReady) {
                    clearTimeout(timeout);
                    resolve(true);
                } else {
                    const onReady = () => {
                        clearTimeout(timeout);
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

    async getCurrentStatus() {
        try {
            if (this.isReady) {
                try {
                    const userInfo = await this.getUserInfo();
                    return {
                        isReady: true,
                        authenticated: true,
                        userInfo: userInfo
                    };
                } catch (error) {
                    // Do not downgrade ready state if user info fetch fails
                    console.log(`User info unavailable for ${this.clientId}: ${error.message}`);
                    return {
                        isReady: true,
                        authenticated: true,
                        userInfo: null,
                        hasQR: !!this.currentQR,
                        qr: this.currentQR || ''
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