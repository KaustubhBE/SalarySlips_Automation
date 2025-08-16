const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true, // Set to false for debugging
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.isReady = false;
        this.currentQR = null;
        this.isInitialized = false;
        
        // Set up event listeners but don't initialize yet
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
                    console.log('Could not get user info, but client is ready');
                }
                
                return { 
                    isReady: true, 
                    qr: '',
                    authenticated: true,
                    message: 'Already authenticated'
                };
            }
            
            // Initialize client if not already done
            if (!this.isInitialized) {
                this.isInitialized = true;
                this.client.initialize();
            }
            
            // Only logout if we're not ready (avoid unnecessary logout for authenticated users)
            if (!this.isReady) {
                try {
                    await this.client.logout();
                } catch (e) {
                    // ignore if already logged out / not authenticated
                }
                this.currentQR = null;
            }

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
    async sendWhatsAppMessage(contactName, message, filePaths = [], fileSequence = [], whatsappNumber, processName) {
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
                            
                            // Add delay between files
                            await new Promise(resolve => setTimeout(resolve, 1000));
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
                            
                            // Add delay between files
                            await new Promise(resolve => setTimeout(resolve, 1000));
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
                            
                            // Add delay between files
                            await new Promise(resolve => setTimeout(resolve, 1000));
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
    async sendBulkMessages(contacts, message, filePaths = [], processName = 'salary_slip') {
        const results = [];
        
        for (const contact of contacts) {
            const result = await this.sendWhatsAppMessage(
                contact.name,
                message,
                filePaths,
                contact.fileSequence || [],
                contact.phoneNumber,
                processName
            );
            
            results.push({
                name: contact.name,
                phoneNumber: contact.phoneNumber,
                success: result
            });

            // Add delay between contacts to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));
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
        this.whatsappService = new WhatsAppService();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'], // React frontend and Python backend
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Setup multer for file uploads
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, 'uploads/');
            },
            filename: (req, file, cb) => {
                cb(null, Date.now() + '-' + file.originalname);
            }
        });
        this.upload = multer({ storage });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                whatsappReady: this.whatsappService.isReady,
                whatsappInitialized: this.whatsappService.isInitialized,
                hasQR: !!this.whatsappService.currentQR,
                timestamp: new Date().toISOString()
            });
        });

        // Get WhatsApp status
        this.app.get('/status', (req, res) => {
            res.json({
                isReady: this.whatsappService.isReady,
                status: this.whatsappService.isReady ? 'ready' : 'initializing'
            });
        });

        // Get current QR (if any)
        this.app.get('/qr', (req, res) => {
            res.json({ qr: this.whatsappService.currentQR || '' });
        });

        // Route for checking authentication status
        this.app.get('/auth-status', async (req, res) => {
            try {
                if (this.whatsappService.isReady) {
                    try {
                        const contacts = await this.whatsappService.client.getContacts();
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
                const success = await this.whatsappService.logout();
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
                const result = await this.whatsappService.triggerLogin();
                
                // Return different response based on authentication status
                if (result.authenticated && result.isReady) {
                    if (result.userInfo) {
                        res.json({ 
                            qr: '',
                            authenticated: true,
                            userInfo: result.userInfo,
                            message: `Already authenticated as ${result.userInfo.name} (${result.userInfo.phoneNumber})`
                        });
                    } else {
                        res.json({ 
                            qr: '',
                            authenticated: true,
                            message: 'Already authenticated'
                        });
                    }
                } else if (result.qr) {
                    res.json({ 
                        qr: result.qr,
                        authenticated: false,
                        message: 'QR code generated, please scan'
                    });
                } else {
                    res.json({ 
                        qr: '',
                        authenticated: false,
                        message: result.message || 'No QR code received'
                    });
                }
            } catch (error) {
                console.error('Error in /trigger-login:', error);
                res.status(500).json({ 
                    error: error.message,
                    authenticated: false 
                });
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
                    file_sequence
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
                    process_name
                );

                res.json({ success: result, contact_name });
            } catch (error) {
                console.error('Error in /send-message:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Bulk message sending (matching Python bulk functionality)
        this.app.post('/send-bulk', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contacts, // Array of contact objects
                    message,
                    process_name = 'salary_slip',
                    file_sequence
                } = req.body;

                // Parse contacts and file_sequence if they're strings
                const parsedContacts = typeof contacts === 'string' ? JSON.parse(contacts) : contacts;
                const parsedFileSequence = file_sequence ? 
                    (typeof file_sequence === 'string' ? JSON.parse(file_sequence) : file_sequence) : [];

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const results = [];
                
                for (const contact of parsedContacts) {
                    try {
                        const result = await this.whatsappService.sendWhatsAppMessage(
                            contact.name,
                            message,
                            filePaths,
                            parsedFileSequence,
                            contact.whatsapp_number,
                            process_name
                        );
                        
                        results.push({
                            name: contact.name,
                            whatsapp_number: contact.whatsapp_number,
                            success: result
                        });

                        // Add delay between contacts to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } catch (error) {
                        console.error(`Error sending to ${contact.name}:`, error);
                        results.push({
                            name: contact.name,
                            whatsapp_number: contact.whatsapp_number,
                            success: false,
                            error: error.message
                        });
                    }
                }

                res.json({ 
                    success: true, 
                    results,
                    total_processed: results.length,
                    successful: results.filter(r => r.success).length
                });
            } catch (error) {
                console.error('Error in /send-bulk:', error);
                res.status(500).json({ error: error.message });
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
                    months_data
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

                const result = await this.whatsappService.sendWhatsAppMessage(
                    contact_name,
                    message.join('\n'),
                    filePaths,
                    [],
                    whatsapp_number,
                    'salary_slip'
                );

                res.json({ success: result, contact_name });
            } catch (error) {
                console.error('Error in /send-salary-notification:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Route for reactor reports (matching process_reactor_reports functionality)
        this.app.post('/send-reactor-report', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    recipients, // Array of email recipients from sheet_recipients_data
                    input_date,
                    sheets_processed
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

                const results = [];
                
                for (const recipient of parsedRecipients) {
                    try {
                        // Extract phone number from recipient data if available
                        const phoneNumber = recipient.phone || recipient.whatsapp_number;
                        if (!phoneNumber) {
                            console.warn(`No phone number found for ${recipient.name}`);
                            continue;
                        }

                        const result = await this.whatsappService.sendWhatsAppMessage(
                            recipient.name,
                            message.join('\n'),
                            filePaths,
                            [],
                            phoneNumber,
                            'reactor_report'
                        );
                        
                        results.push({
                            name: recipient.name,
                            phone_number: phoneNumber,
                            success: result
                        });

                        // Add delay between messages
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        console.error(`Error sending to ${recipient.name}:`, error);
                        results.push({
                            name: recipient.name,
                            success: false,
                            error: error.message
                        });
                    }
                }

                res.json({ 
                    success: true, 
                    results,
                    message: "Reactor report notifications sent"
                });
            } catch (error) {
                console.error('Error in /send-reactor-report:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Route for general reports (matching send-reports functionality)
        this.app.post('/send-general-report', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contact_name,
                    message,
                    whatsapp_number,
                    file_sequence
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
                    'report'
                );

                res.json({ success: result, contact_name });
            } catch (error) {
                console.error('Error in /send-general-report:', error);
                res.status(500).json({ error: error.message });
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

module.exports = { WhatsAppService, WhatsAppServer };