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
            
            // First, verify that the session folder still exists on disk
            const sessionPath = this.getSessionPath(sanitizedClientId);
            const sessionExistsOnDisk = await this.checkSessionExistsOnDisk(sessionPath);
            
            if (!sessionExistsOnDisk) {
                console.log(`Session folder deleted from disk for ${sanitizedClientId}, cleaning up from memory`);
                this.cleanupSession(sanitizedClientId);
            } else if (this.isSessionValid(session)) {
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
        const isAuthenticated = session.authenticatedAt && (now - session.authenticatedAt) < 24 * 60 * 60 * 1000; // 24 hours
        const effectiveTimeout = isAuthenticated ? 2 * 60 * 60 * 1000 : this.sessionTimeout; // 2 hours for authenticated, 30 min for others
        
        // Session is valid if:
        // 1. It's been accessed within the timeout period
        // 2. It hasn't been created too recently (prevent rapid recreation)
        const isWithinAccessTimeout = timeSinceLastAccess < effectiveTimeout;
        const isNotTooRecent = timeSinceCreation > 5000; // 5 seconds minimum age
        
        // Additional check: if session has been accessed recently (within last 2 minutes), 
        // consider it active even if it's close to timeout (heartbeat system)
        const recentlyActive = timeSinceLastAccess < 2 * 60 * 1000; // 2 minutes
        
        return (isWithinAccessTimeout && isNotTooRecent) || recentlyActive;
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
        
        // Also check for orphaned sessions from browser close
        this.cleanupOrphanedSessionsFromBrowserClose();
    }

    // Clean up orphaned sessions from browser close
    async cleanupOrphanedSessionsFromBrowserClose() {
        try {
            const { logoutHandler } = require('./handleLogout');
            const result = await logoutHandler.cleanupOrphanedSessionsFromBrowserClose();
            
            if (result.success && result.cleanedSessions.length > 0) {
                console.log(`Cleaned up ${result.cleanedSessions.length} orphaned sessions from browser close`);
                
                // Also clean up these sessions from memory
                result.cleanedSessions.forEach(clientId => {
                    this.cleanupSession(clientId);
                });
            }
        } catch (error) {
            console.error('Error cleaning up orphaned sessions from browser close:', error);
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

    // Method to update session activity from heartbeat
    updateSessionActivity(clientId) {
        const sanitizedClientId = this.sanitizeClientId(clientId);
        const session = this.sessions.get(sanitizedClientId);
        if (session) {
            session.lastAccessed = Date.now();
            console.log(`Session activity updated for user: ${sanitizedClientId}`);
            return true;
        }
        return false;
    }

    // Method to update session activity from heartbeat
    updateSessionActivity(clientId) {
        const sanitizedClientId = this.sanitizeClientId(clientId);
        const session = this.sessions.get(sanitizedClientId);
        if (session) {
            session.lastAccessed = Date.now();
            console.log(`Session activity updated for user: ${sanitizedClientId}`);
            return true;
        }
        return false;
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

    // Clear all sessions (for startup cleanup)
    clearAllSessions() {
        try {
            console.log('🧹 Clearing all sessions from session manager...');
            
            // Disconnect all services
            for (const [clientId, service] of this.serviceInstances) {
                try {
                    if (service && typeof service.disconnect === 'function') {
                        service.disconnect();
                    }
                } catch (error) {
                    console.error(`Error disconnecting service for ${clientId}:`, error);
                }
            }
            
            // Clear all maps
            this.sessions.clear();
            this.serviceInstances.clear();
            this.lastCreationTimes.clear();
            this.logThrottle.clear();
            this.creationLocks.clear();
            
            console.log('✅ All sessions cleared from session manager');
            
        } catch (error) {
            console.error('❌ Error clearing sessions:', error);
        }
    }

    // Helper method to get session path for a client ID
    getSessionPath(clientId) {
        const path = require('path');
        const authBasePath = path.join(process.cwd(), '.wwebjs_auth');
        return path.join(authBasePath, `session-${clientId}`);
    }

    // Helper method to check if session folder exists on disk
    async checkSessionExistsOnDisk(sessionPath) {
        try {
            const fs = require('fs').promises;
            await fs.access(sessionPath, fs.constants.F_OK);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Create singleton instance
const sessionManager = new WhatsAppSessionManager();

module.exports = { WhatsAppSessionManager, sessionManager };

