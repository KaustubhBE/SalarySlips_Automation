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
        
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, uploadsDir);
            },
            filename: (req, file, cb) => {
                const original = file.originalname;
                const parts = original.split('-', 2);
                const cleaned = (parts.length === 2 && /^\d{10,}$/.test(parts[0])) ? parts[1] : original;
                cb(null, cleaned);
            }
        });
        this.upload = multer({ storage });

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
                    options = '{}'
                } = req.body;

                // Parse JSON strings if needed
                let parsedVariables = {};
                let parsedOptions = {};
                
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

                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const service = await this.getServiceForRequest(req);
                const result = await service.sendWhatsAppMessage(
                    contact_name,
                    '', // Empty message - will use template from message.json
                    filePaths,
                    [], // file_sequence not needed in unified approach
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
                this.cleanUploads();
            }
        });

        this.app.post('/send-bulk', this.upload.array('files'), async (req, res) => {
            try {
                const {
                    contacts, // Array of contact objects
                    process_name = 'salary_slip',
                    message = '',
                    variables = '{}',
                    options = '{}'
                } = req.body;

                // Parse JSON strings if needed
                let parsedContacts = [];
                let parsedVariables = {};
                let parsedOptions = {};
                
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

                // Get uploaded file paths
                const filePaths = req.files ? req.files.map(file => file.path) : [];

                const service = await this.getServiceForRequest(req);
                const results = await service.sendBulkMessages(
                    parsedContacts.map(c => ({
                        name: c.name,
                        phoneNumber: c.whatsapp_number || c.phoneNumber || c.phone
                    })),
                    '', // Empty message - will use template from message.json
                    filePaths,
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
                this.cleanUploads();
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