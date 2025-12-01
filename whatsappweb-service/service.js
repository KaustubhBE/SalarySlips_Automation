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
            // Add a small delay to prevent conflicts with manual initialization requests
            setTimeout(() => {
                this.authClient.initialize().then(() => {
                    this.syncAuthState();
                    console.log(`Auto-initialization completed for clientId: ${this.clientId}`);
                }).catch((error) => {
                    // Only log if it's not a SingletonLock error (which is expected during concurrent init)
                    if (!error.message || !error.message.includes('SingletonLock')) {
                        console.error(`Auto-initialization failed for clientId: ${this.clientId}:`, error);
                    } else {
                        console.log(`Auto-initialization skipped for clientId: ${this.clientId} (concurrent initialization in progress)`);
                    }
                });
            }, 1000); // 1 second delay to allow manual initialization to proceed first
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
