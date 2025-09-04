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
        
        // Start cleanup timer
        this.startCleanupTimer();
        
        console.log('WhatsApp Session Manager initialized');
    }

    getServiceForClient(clientId) {
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
        
        // Check creation cooldown to prevent rapid session creation
        if (this.isInCreationCooldown(sanitizedClientId)) {
            // Return existing service if available, even if expired
            const existingService = this.serviceInstances.get(sanitizedClientId);
            if (existingService) {
                return existingService;
            }
        }
        
        // Create new session
        return this.createNewSession(sanitizedClientId);
    }

    createNewSession(clientId) {
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
        const isAuthenticated = session.authenticatedAt && (now - session.authenticatedAt) < 24 * 60 * 60 * 1000; // 24 hours
        const effectiveTimeout = isAuthenticated ? 2 * 60 * 60 * 1000 : this.sessionTimeout; // 2 hours for authenticated, 30 min for others
        
        // Session is valid if:
        // 1. It's been accessed within the timeout period
        // 2. It hasn't been created too recently (prevent rapid recreation)
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

