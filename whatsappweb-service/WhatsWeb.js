const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor(clientId = 'default') {
        this.clientId = String(clientId);
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: this.clientId }),
            puppeteer: {
                headless: true, // Set to false for debugging
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.isReady = false;
        this.currentQR = null;
        this.isInitialized = false;
        this._lastUserInfoErrorLoggedAt = 0;
        
        // Set up event listeners but don't initialize yet
        this.setupEventListeners();
    }

    async resetClient(reason = 'unknown') {
        try {
            console.warn('Resetting WhatsApp client due to:', reason);
            try { await this.client.destroy(); } catch (_) {}
        } catch (_) {}
        // Recreate client
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: this.clientId }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        this.isReady = false;
        this.currentQR = null;
        this.isInitialized = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Generate QR code for authentication
        this.client.on('qr', (qr) => {
            console.log('QR Code received, scan with your phone');
            this.currentQR = qr;
        });

        // Client is ready
        this.client.on('ready', () => {
            console.log('WhatsApp Client is ready!');
            this.isReady = true;
            this.currentQR = null;
        });

        // Authentication successful
        this.client.on('authenticated', () => {
            console.log('WhatsApp Client authenticated!');
            this.currentQR = null;
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            console.error('Authentication failed:', msg);
        });

        // Client disconnected
        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp Client disconnected:', reason);
            this.isReady = false;
            this.currentQR = null;
        });
    }

    async waitForReady() {
        return new Promise((resolve) => {
            if (this.isReady) {
                resolve();
            } else {
                this.client.on('ready', () => {
                    resolve();
                });
            }
        });
    }

    async triggerLogin(timeoutMs = 10000) {
        try {
            // If already ready and authenticated, return status instead of forcing new login
            if (this.isReady) {
                try {
                    // Get the authenticated user's info
                    const contacts = await this.client.getContacts();
                    const me = contacts.find(contact => contact.isMe);
                    
                    if (me) {
                        const userInfo = {
                            isReady: true,
                            qr: '',
                            authenticated: true,
                            userInfo: {
                                name: me.name || 'Unknown',
                                phoneNumber: me.number || 'Unknown',
                                pushName: me.pushname || 'Unknown'
                            }
                        };
                        console.log('User already authenticated:', userInfo.userInfo);
                        return userInfo;
                    }
                } catch (error) {
                    const msg = (error && error.message) || '';
                    // If session/page was closed while AFK, reset client and fall back to QR flow
                    if (msg.includes('Session closed')) {
                        await this.resetClient('puppeteer session closed');
                    } else {
                        // Soft warning, do not spam
                        const now = Date.now();
                        if (now - this._lastUserInfoErrorLoggedAt > 15000) {
                            console.log('Could not get user info, but client is ready');
                            this._lastUserInfoErrorLoggedAt = now;
                        }
                        // Still return authenticated state
                        return { isReady: true, qr: '', authenticated: true };
                    }
                }
                
                // If we didn't return yet, we'll proceed to init below to get fresh QR
            }
            
            // Initialize client if not already done
            if (!this.isInitialized) {
                this.isInitialized = true;
                this.client.initialize();
            }
            
            // Ensure currentQR is clear before new login
            this.currentQR = null;

            // Wait for QR or ready status
            const result = await new Promise((resolve) => {
                if (this.currentQR) {
                    return resolve({ 
                        isReady: this.isReady, 
                        qr: this.currentQR,
                        authenticated: false 
                    });
                }
                
                let resolved = false;
                
                const onQR = (qr) => {
                    if (!resolved) {
                        resolved = true;
                        resolve({ 
                            isReady: this.isReady, 
                            qr,
                            authenticated: false 
                        });
                    }
                };
                
                const onReady = () => {
                    if (!resolved) {
                        resolved = true;
                        resolve({ 
                            isReady: true, 
                            qr: '',
                            authenticated: true,
                            message: 'Authentication successful'
                        });
                    }
                };
                
                // Listen for both QR and ready events
                this.client.once('qr', onQR);
                this.client.once('ready', onReady);
                
                // Timeout fallback
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve({ 
                            isReady: this.isReady, 
                            qr: this.currentQR || '',
                            authenticated: this.isReady,
                            message: this.isReady ? 'Already authenticated' : 'No QR received'
                        });
                    }
                }, timeoutMs);
            });
            
            return result;
        } catch (error) {
            console.error('Error triggering login:', error);
            return { 
                isReady: false, 
                qr: '',
                authenticated: false,
                error: error.message 
            };
        }
    }

    async logout() {
        try {
            if (this.isReady) {
                await this.client.logout();
                this.isReady = false;
                this.currentQR = null;
                this.isInitialized = false;
                console.log('WhatsApp client logged out successfully');
                return true;
            } else {
                console.log('WhatsApp client not ready, no logout needed');
                return true;
            }
        } catch (error) {
            const msg = (error && error.message) || '';
            if (msg.includes('Session closed')) {
                // Treat as already logged out
                this.isReady = false;
                this.currentQR = null;
                this.isInitialized = false;
                console.log('Logout: session already closed, state cleared');
                return true;
            }
            console.error('Error during logout:', error);
            return false;
        }
    }

    /**
     * Get employee contact from contact data
     */
    getEmployeeContact(employeeName, contactEmployees) {
        try {
            if (!Array.isArray(contactEmployees)) {
                console.error('Error: contactEmployees is not an array');
                return '';
            }

            const record = contactEmployees.find(record => 
                record && record.Name === employeeName
            );

            if (record && record['Contact No.']) {
                const contact = String(record['Contact No.']).trim();
                console.log(`Found contact for ${employeeName}: ${contact}`);
                return contact;
            }

            console.warn(`No contact found for ${employeeName}`);
            return '';
        } catch (error) {
            console.error(`Error getting contact for ${employeeName}:`, error);
            return '';
        }
    }

    /**
     * Format phone number for WhatsApp (with country code)
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if not present (assuming India +91)
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        
        return cleaned + '@c.us';
    }

    /**
     * Prepare file paths and validate files
     */
    async prepareFilePaths(filePaths, tempDir = null, isUpload = false) {
        try {
            if (!filePaths) return [];

            // Convert single path to array
            if (!Array.isArray(filePaths)) {
                filePaths = [filePaths];
            }

            const validPaths = [];
            const seenFilenames = new Set();

            for (const filePath of filePaths) {
                if (isUpload) {
                    // Handle uploaded files (if using with Express.js)
                    if (filePath.filename) {
                        const tempPath = path.join(tempDir, filePath.filename);
                        await fs.promises.writeFile(tempPath, filePath.buffer);
                        validPaths.push(tempPath);
                        seenFilenames.add(filePath.filename);
                        console.log(`Saved uploaded file: ${tempPath}`);
                    }
                } else {
                    // Handle existing file paths
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

            console.log(`Prepared ${validPaths.length} valid file paths`);
            return validPaths;
        } catch (error) {
            console.error('Error preparing file paths:', error);
            return [];
        }
    }

    /**
     * Send WhatsApp message with attachments
     */
    async sendWhatsAppMessage(contactName, message, filePaths = [], fileSequence = [], whatsappNumber, processName, options = {}) {
        try {
            await this.waitForReady();

            if (!whatsappNumber) {
                console.error(`Phone number not found for ${contactName}`);
                return false;
            }

            // Format the phone number
            const formattedNumber = this.formatPhoneNumber(whatsappNumber);
            console.log(`Sending message to ${contactName} (${formattedNumber})`);

            // Check if contact exists
            const contact = await this.client.getContactById(formattedNumber);
            if (!contact) {
                console.error(`Contact not found: ${contactName} (${formattedNumber})`);
                return false;
            }

            // Prepare file paths
            const validFilePaths = await this.prepareFilePaths(filePaths);
            
            // Create filename to path mapping
            const filenameToPathMap = {};
            validFilePaths.forEach(filePath => {
                const filename = path.basename(filePath);
                filenameToPathMap[filename] = filePath;
            });

            const perFileDelayMs = Number(options.perFileDelayMs || 1000);
            if (processName === 'salary_slip') {
                // Send message first
                if (message) {
                    if (Array.isArray(message)) {
                        await this.client.sendMessage(formattedNumber, message.join('\n'));
                    } else {
                        await this.client.sendMessage(formattedNumber, message);
                    }
                    console.log(`Message sent to ${contactName}`);
                }

                // Send files if any
                if (validFilePaths.length > 0) {
                    for (const filePath of validFilePaths) {
                        try {
                            const media = MessageMedia.fromFilePath(filePath);
                            await this.client.sendMessage(formattedNumber, media);
                            console.log(`File sent: ${path.basename(filePath)}`);
                            
                            // Add delay between files (configurable)
                            await new Promise(resolve => setTimeout(resolve, perFileDelayMs));
                        } catch (error) {
                            console.error(`Error sending file ${filePath}:`, error);
                        }
                    }
                }
            } else if (processName === 'report') {
                // Send message first
                if (message) {
                    if (Array.isArray(message)) {
                        await this.client.sendMessage(formattedNumber, message.join('\n'));
                    } else {
                        await this.client.sendMessage(formattedNumber, message);
                    }
                    console.log(`Report message sent to ${contactName}`);
                }

                // Send files if any
                if (validFilePaths.length > 0) {
                    for (const filePath of validFilePaths) {
                        try {
                            const media = MessageMedia.fromFilePath(filePath);
                            await this.client.sendMessage(formattedNumber, media);
                            console.log(`Report file sent: ${path.basename(filePath)}`);
                            
                            // Add delay between files (configurable)
                            await new Promise(resolve => setTimeout(resolve, perFileDelayMs));
                        } catch (error) {
                            console.error(`Error sending report file ${filePath}:`, error);
                        }
                    }
                }
            } else if (processName === 'reactor_report') {
                // Send message first
                if (message) {
                    if (Array.isArray(message)) {
                        await this.client.sendMessage(formattedNumber, message.join('\n'));
                    } else {
                        await this.client.sendMessage(formattedNumber, message);
                    }
                    console.log(`Reactor report message sent to ${contactName}`);
                }

                // Send files if any
                if (validFilePaths.length > 0) {
                    for (const filePath of validFilePaths) {
                        try {
                            const media = MessageMedia.fromFilePath(filePath);
                            await this.client.sendMessage(formattedNumber, media);
                            console.log(`Reactor report file sent: ${path.basename(filePath)}`);
                            
                            // Add delay between files (configurable)
                            await new Promise(resolve => setTimeout(resolve, perFileDelayMs));
                        } catch (error) {
                            console.error(`Error sending reactor report file ${filePath}:`, error);
                        }
                    }
                }
            }

            console.log(`Successfully sent message to ${contactName} with ${validFilePaths.length} attachments`);
            return true;

        } catch (error) {
            console.error(`Error sending WhatsApp message to ${contactName}:`, error);
            return false;
        }
    }

    /**
     * Send message to multiple contacts
     */
    async sendBulkMessages(contacts, message, filePaths = [], processName = 'salary_slip', options = {}) {
        const results = [];
        const perContactDelayMs = Number(options.perContactDelayMs || 3000);
        
        for (const contact of contacts) {
            const result = await this.sendWhatsAppMessage(
                contact.name,
                message,
                filePaths,
                contact.fileSequence || [],
                contact.phoneNumber,
                processName,
                options
            );
            
            results.push({
                name: contact.name,
                phoneNumber: contact.phoneNumber,
                success: result
            });

            // Add delay between contacts to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, perContactDelayMs));
        }

        return results;
    }

    /**
     * Cleanup and disconnect
     */
    async disconnect() {
        await this.client.destroy();
        console.log('WhatsApp client disconnected');
    }
}

// Express.js server integration
const express = require('express');
const cors = require('cors');
const multer = require('multer');

class WhatsAppServer {
    constructor(port = 3001) {
        this.app = express();
        this.port = port;
        // Map of email -> WhatsAppService (isolated sessions)
        this.services = new Map();
        const sanitizeClientId = (value) => {
            try {
                return String(value || 'default')
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, '_')
                    .slice(0, 64);
            } catch (_) {
                return 'default';
            }
        };
        this.getServiceKey = (req) => {
            try {
                const bodyEmail = (req.body && (req.body.user_email || req.body.email)) || '';
                const headerEmail = req.headers['x-user-email'] || '';
                const raw = String(bodyEmail || headerEmail || 'default').toLowerCase();
                return sanitizeClientId(raw) || 'default';
            } catch (_) {
                return 'default';
            }
        };
        this.getServiceForRequest = (req) => {
            const key = this.getServiceKey(req);
            if (!this.services.has(key)) {
                this.services.set(key, new WhatsAppService(key));
            }
            return this.services.get(key);
        };
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'], // React frontend and Python backend
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Email']
        }));
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Setup multer for file uploads
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, uploadsDir);
            },
            filename: (req, file, cb) => {
                // Preserve original filename (strip any leading numeric prefixes if present)
                const original = file.originalname;
                const parts = original.split('-', 2);
                const cleaned = (parts.length === 2 && /^\d{10,}$/.test(parts[0])) ? parts[1] : original;
                cb(null, cleaned);
            }
        });
        this.upload = multer({ storage });

        // Helper to clean uploads directory
        this.cleanUploads = () => {
            try {
                const files = fs.readdirSync(uploadsDir);
                for (const f of files) {
                    try {
                        fs.unlinkSync(path.join(uploadsDir, f));
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
        // Health check
        this.app.get('/health', (req, res) => {
            const svc = this.getServiceForRequest(req);
            res.json({ 
                status: 'ok', 
                whatsappReady: svc.isReady,
                whatsappInitialized: svc.isInitialized,
                hasQR: !!svc.currentQR,
                timestamp: new Date().toISOString()
            });
        });

        // Get WhatsApp status
        this.app.get('/status', (req, res) => {
            const svc = this.getServiceForRequest(req);
            res.json({
                isReady: svc.isReady,
                status: svc.isReady ? 'ready' : 'initializing'
            });
        });

        // Get current QR (if any)
        this.app.get('/qr', (req, res) => {
            const svc = this.getServiceForRequest(req);
            const qr = svc.currentQR || '';
            // Include both new and legacy shapes
            res.json({ success: true, data: { qr }, qr });
        });

        // Route for checking authentication status
        this.app.get('/auth-status', async (req, res) => {
            try {
                const svc = this.getServiceForRequest(req);
                if (svc.isReady) {
                    try {
                        const contacts = await svc.client.getContacts();
                        const me = contacts.find(contact => contact.isMe);
                        
                        if (me) {
                            res.json({
                                authenticated: true,
                                userInfo: {
                                    name: me.pushname || me.name || 'Unknown',
                                    phoneNumber: me.number || 'Unknown',
                                    pushName: me.pushname || 'Unknown'
                                }
                            });
                        } else {
                            res.json({
                                authenticated: true,
                                userInfo: {
                                    name: 'Authenticated User',
                                    phoneNumber: 'Unknown',
                                    pushName: 'Unknown'
                                }
                            });
                        }
                    } catch (error) {
                        console.error('Error getting user info:', error);
                        res.json({
                            authenticated: true,
                            userInfo: {
                                name: 'Authenticated User',
                                phoneNumber: 'Unknown',
                                pushName: 'Unknown'
                            }
                        });
                    }
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

        // Route for logout
        this.app.post('/logout', async (req, res) => {
            try {
                const success = await this.getServiceForRequest(req).logout();
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

        // Trigger a fresh login (refresh QR)
        this.app.post('/trigger-login', async (req, res) => {
            try {
                const result = await this.getServiceForRequest(req).triggerLogin();
                
                // Return different response based on authentication status
                if (result.authenticated && result.isReady) {
                    if (result.userInfo) {
                        const payload = { 
                            qr: '',
                            authenticated: true,
                            userInfo: result.userInfo,
                            message: `Already authenticated as ${result.userInfo.name} (${result.userInfo.phoneNumber})`
                        };
                        res.json({ success: true, data: payload, ...payload });
                    } else {
                        const payload = { 
                            qr: '',
                            authenticated: true,
                            message: 'Already authenticated'
                        };
                        res.json({ success: true, data: payload, ...payload });
                    }
                } else if (result.qr) {
                    const payload = { 
                        qr: result.qr,
                        authenticated: false,
                        message: 'QR code generated, please scan'
                    };
                    res.json({ success: true, data: payload, ...payload });
                } else {
                    const payload = { 
                        qr: '',
                        authenticated: false,
                        message: result.message || 'No QR code received'
                    };
                    res.json({ success: true, data: payload, ...payload });
                }
            } catch (error) {
                console.error('Error in /trigger-login:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Send single WhatsApp message (matching Python functionality)
        this.app.post('/send-message', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contact_name,
                    message,
                    whatsapp_number,
                    process_name = 'salary_slip',
                    file_sequence,
                    options
                } = req.body;

                // Parse file_sequence if it's a string
                let parsedFileSequence = [];
                if (file_sequence) {
                    parsedFileSequence = typeof file_sequence === 'string' 
                        ? JSON.parse(file_sequence) 
                        : file_sequence;
                }

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const result = await this.getServiceForRequest(req).sendWhatsAppMessage(
                    contact_name,
                    message,
                    filePaths,
                    parsedFileSequence,
                    whatsapp_number,
                    process_name,
                    options || {}
                );

                res.json({ success: true, data: { sent: !!result, contact_name } });
            } catch (error) {
                console.error('Error in /send-message:', error);
                res.status(500).json({ success: false, error: error.message });
            } finally {
                this.cleanUploads();
            }
        });

        // Bulk message sending (matching Python bulk functionality)
        this.app.post('/send-bulk', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contacts, // Array of contact objects
                    message,
                    process_name = 'salary_slip',
                    file_sequence,
                    options
                } = req.body;

                // Parse contacts and file_sequence if they're strings
                const parsedContacts = typeof contacts === 'string' ? JSON.parse(contacts) : contacts;
                const parsedFileSequence = file_sequence ? 
                    (typeof file_sequence === 'string' ? JSON.parse(file_sequence) : file_sequence) : [];

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const results = await this.getServiceForRequest(req).sendBulkMessages(
                    parsedContacts.map(c => ({
                        name: c.name,
                        phoneNumber: c.whatsapp_number,
                        fileSequence: c.fileSequence || []
                    })),
                    message,
                    filePaths,
                    process_name,
                    options || {}
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
                this.cleanUploads();
            }
        });

        // Route specifically for salary slip notifications (matching Python handle_whatsapp_notification)
        this.app.post('/send-salary-notification', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contact_name,
                    full_month,
                    full_year,
                    whatsapp_number,
                    is_special = false,
                    months_data,
                    options
                } = req.body;

                // Parse months_data if it's a string
                const parsedMonthsData = months_data ? 
                    (typeof months_data === 'string' ? JSON.parse(months_data) : months_data) : [];

                // Create salary slip message (matching Python format)
                const message = [
                    `Dear ${contact_name},`,
                    "",
                    "Please find attached your salary slips for the following months:",
                    "",
                    ...parsedMonthsData.map(month => `   -  ${month.month} ${month.year}`),
                    "",
                    "These documents include:",
                    "   -  Earnings Breakdown",
                    "   -  Deductions Summary", 
                    "   -  Net Salary Details",
                    "",
                    "Kindly review the salary slips, and if you have any questions or concerns, please feel free to reach out to the HR department.",
                    "",
                    "Thanks & Regards,",
                    "HR Department",
                    "Bajaj Earths Pvt. Ltd.",
                    "+91 - 86557 88172"
                ];

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const result = await this.getServiceForRequest(req).sendWhatsAppMessage(
                    contact_name,
                    message.join('\n'),
                    filePaths,
                    [],
                    whatsapp_number,
                    'salary_slip',
                    options || {}
                );

                res.json({ success: true, data: { sent: !!result, contact_name } });
            } catch (error) {
                console.error('Error in /send-salary-notification:', error);
                res.status(500).json({ success: false, error: error.message });
            } finally {
                this.cleanUploads();
            }
        });

        // Route for reactor reports (matching process_reactor_reports functionality)
        this.app.post('/send-reactor-report', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    recipients, // Array of email recipients from sheet_recipients_data
                    input_date,
                    sheets_processed,
                    options
                } = req.body;

                // Parse recipients if it's a string
                const parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;

                // Create reactor report message
                const message = [
                    "Reactor Report - Daily Operations Summary",
                    "",
                    `Please find attached the reactor report for the period from ${input_date} to ${input_date}.`,
                    "",
                    "This report contains snapshots of all reactor operations data for the specified period.",
                    "",
                    `Sheets processed: ${sheets_processed}`,
                    "",
                    "Best regards,",
                    "Reactor Automation System"
                ];

                // Get uploaded file paths  
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const results = await this.getServiceForRequest(req).sendBulkMessages(
                    parsedRecipients
                        .filter(r => (r.phone || r.whatsapp_number))
                        .map(r => ({ name: r.name, phoneNumber: r.phone || r.whatsapp_number })),
                    message.join('\n'),
                    filePaths,
                    'reactor_report',
                    Object.assign({ perContactDelayMs: 2000 }, options || {})
                );

                res.json({ success: true, data: { 
                    results,
                    message: "Reactor report notifications sent"
                }});
            } catch (error) {
                console.error('Error in /send-reactor-report:', error);
                res.status(500).json({ success: false, error: error.message });
            } finally {
                this.cleanUploads();
            }
        });

        // Route for general reports (matching send-reports functionality)
        this.app.post('/send-general-report', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contact_name,
                    message,
                    whatsapp_number,
                    file_sequence,
                    options
                } = req.body;

                // Parse file_sequence if it's a string
                let parsedFileSequence = [];
                if (file_sequence) {
                    parsedFileSequence = typeof file_sequence === 'string' 
                        ? JSON.parse(file_sequence) 
                        : file_sequence;
                }

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const result = await this.whatsappService.sendWhatsAppMessage(
                    contact_name,
                    message,
                    filePaths,
                    parsedFileSequence,
                    whatsapp_number,
                    'report',
                    options || {}
                );

                res.json({ success: true, data: { sent: !!result, contact_name } });
            } catch (error) {
                console.error('Error in /send-general-report:', error);
                res.status(500).json({ success: false, error: error.message });
            } finally {
                this.cleanUploads();
            }
        });
    }

    async start() {
        // Don't wait for WhatsApp to be ready before starting server
        // The service will be ready when explicitly requested through API calls
        
        this.app.listen(this.port, () => {
            console.log(`WhatsApp server running on port ${this.port}`);
            console.log(`Health check: http://localhost:${this.port}/health`);
            console.log('WhatsApp service is ready to accept requests');
        });
    }

    async stop() {
        await this.whatsappService.disconnect();
    }
}

function createService() {
    return new WhatsAppService();
}

module.exports = { WhatsAppService, WhatsAppServer, createService };