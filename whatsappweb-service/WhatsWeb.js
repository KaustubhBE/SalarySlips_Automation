const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { WhatsAppService } = require('./service');
const { sessionManager } = require('./sessionManager');
const { logoutHandler } = require('./handleLogout');

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
                const bodyEmail = (req.body && (req.body.user_email || req.body.email || req.body.clientId)) || '';
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

        // Perform comprehensive cleanup on service startup
        this.performStartupCleanup = () => {
            try {
                console.log('🧹 Performing startup cleanup...');
                
                const authDir = path.join(__dirname, '.wwebjs_auth');
                const cacheDir = path.join(__dirname, '.wwebjs_cache');
                
                // Delete .wwebjs_auth directory
                if (fs.existsSync(authDir)) {
                    console.log('🗑️  Deleting .wwebjs_auth directory...');
                    fs.rmSync(authDir, { recursive: true, force: true });
                    console.log('✅ .wwebjs_auth directory deleted successfully');
                } else {
                    console.log('ℹ️  .wwebjs_auth directory does not exist');
                }
                
                // Delete .wwebjs_cache directory
                if (fs.existsSync(cacheDir)) {
                    console.log('🗑️  Deleting .wwebjs_cache directory...');
                    fs.rmSync(cacheDir, { recursive: true, force: true });
                    console.log('✅ .wwebjs_cache directory deleted successfully');
                } else {
                    console.log('ℹ️  .wwebjs_cache directory does not exist');
                }
                
                // Clear session manager
                sessionManager.clearAllSessions();
                console.log('✅ Session manager cleared');
                
                console.log('🎉 Startup cleanup completed successfully');
                
            } catch (error) {
                console.error('❌ Error during startup cleanup:', error);
                // Don't throw error, just log it and continue
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    // Removed performStartupCleanup - cleanup only happens in start.js now

    setupMiddleware() {
        this.app.use(cors({
            origin: [
                'https://uatadmin.bajajearths.com',
                'https://uatwhatsapp.bajajearths.com',
                'https://uatbackendadmin.bajajearths.com'
                
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Email', 'x-user-email']
        }));
        
        // Custom middleware to handle text/plain content from sendBeacon
        this.app.use((req, res, next) => {
            if (req.get('Content-Type') === 'text/plain;charset=UTF-8') {
                let data = '';
                req.setEncoding('utf8');
                req.on('data', chunk => {
                    data += chunk;
                });
                req.on('end', () => {
                    try {
                        req.body = JSON.parse(data);
                    } catch (e) {
                        req.body = {};
                    }
                    next();
                });
            } else {
                next();
            }
        });
        
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
                const clientId = this.getServiceKey(req);
                console.log(`Logout request for client: ${clientId}`);
                
                // Get the service and logout from WhatsApp
                const svc = await this.getServiceForRequest(req);
                const whatsappLogoutSuccess = await svc.logout();
                
                // Delete the user's session folder
                const sessionDeletionResult = await logoutHandler.deleteUserSession(clientId);
                
                // Clean up the session from session manager
                sessionManager.forceCleanupSession(clientId);
                
                if (whatsappLogoutSuccess && sessionDeletionResult.success) {
                    console.log(`Complete logout successful for client: ${clientId}`);
                    res.json({ 
                        success: true, 
                        message: 'Logged out successfully and session cleaned up',
                        sessionDeleted: sessionDeletionResult.deletedPath
                    });
                } else if (whatsappLogoutSuccess) {
                    console.log(`WhatsApp logout successful but session cleanup failed for client: ${clientId}`);
                    res.json({ 
                        success: true, 
                        message: 'WhatsApp logged out but session cleanup failed',
                        sessionDeleted: false,
                        sessionError: sessionDeletionResult.message
                    });
                } else {
                    console.log(`Logout failed for client: ${clientId}`);
                    res.status(500).json({ 
                        success: false, 
                        message: 'WhatsApp logout failed',
                        sessionDeleted: sessionDeletionResult.success
                    });
                }
            } catch (error) {
                console.error('Error during logout:', error);
                res.status(500).json({ success: false, message: 'Logout error: ' + error.message });
            }
        });

        // Endpoint to get session information
        this.app.get('/session-info', async (req, res) => {
            try {
                const sessionInfo = await logoutHandler.getSessionInfo();
                res.json(sessionInfo);
            } catch (error) {
                console.error('Error getting session info:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Endpoint to clean up orphaned sessions
        this.app.post('/cleanup-sessions', async (req, res) => {
            try {
                const cleanupResult = await logoutHandler.cleanupOrphanedSessions();
                res.json(cleanupResult);
            } catch (error) {
                console.error('Error cleaning up sessions:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Endpoint to delete a specific user's session (admin only)
        this.app.post('/delete-session', async (req, res) => {
            try {
                const { clientId } = req.body;
                if (!clientId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Client ID is required' 
                    });
                }

                const deletionResult = await logoutHandler.deleteUserSession(clientId);
                
                if (deletionResult.success) {
                    // Also clean up from session manager
                    sessionManager.forceCleanupSession(clientId);
                }
                
                res.json(deletionResult);
            } catch (error) {
                console.error('Error deleting session:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Endpoint to clean up lock files for a specific user
        this.app.post('/cleanup-lock-files', async (req, res) => {
            try {
                const clientId = this.getServiceKey(req);
                console.log(`Cleaning up lock files for client: ${clientId}`);
                
                const cleanupResult = await logoutHandler.cleanupUserLockFiles(clientId);
                res.json(cleanupResult);
            } catch (error) {
                console.error('Error cleaning up lock files:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Endpoint to handle user heartbeat/ping to track active users
        this.app.post('/heartbeat', async (req, res) => {
            try {
                const clientId = this.getServiceKey(req);
                if (!clientId || clientId === 'default') {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Valid client ID is required' 
                    });
                }

                // Update session activity to keep it alive
                const session = sessionManager.sessions.get(clientId);
                if (session) {
                    session.lastAccessed = Date.now();
                    console.log(`Heartbeat received for user: ${clientId}`);
                }

                res.json({ 
                    success: true, 
                    message: 'Heartbeat received',
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error handling heartbeat:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Endpoint to handle browser close detection
        this.app.post('/browser-close', async (req, res) => {
            try {
                console.log('Browser close request received:', {
                    body: req.body,
                    headers: req.headers,
                    userAgent: req.get('User-Agent'),
                    contentType: req.get('Content-Type')
                });
                
                const clientId = this.getServiceKey(req);
                console.log(`Extracted client ID: ${clientId}`);
                
                if (!clientId || clientId === 'default') {
                    console.log('Invalid client ID, returning 400 error');
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Valid client ID is required' 
                    });
                }

                console.log(`Browser close detected for user: ${clientId}`);
                
                // Clean up session folder
                const result = await logoutHandler.handleBrowserClose(clientId);
                
                // Also clean up from session manager
                sessionManager.forceCleanupSession(clientId);
                
                console.log('Browser close cleanup result:', result);
                res.json(result);
            } catch (error) {
                console.error('Error handling browser close:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Endpoint to clean up orphaned sessions from browser close
        this.app.post('/cleanup-orphaned-sessions', async (req, res) => {
            try {
                const result = await logoutHandler.cleanupOrphanedSessionsFromBrowserClose();
                res.json(result);
            } catch (error) {
                console.error('Error cleaning up orphaned sessions:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
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
            console.log(`Domain access: https://uatwhatsapp.bajajearths.com/health`);
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