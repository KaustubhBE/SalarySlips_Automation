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

    async sendWhatsAppMessage(contactName, message, filePaths = [], whatsappNumber, processName, options = {}) {
        try {
            await this.authClient.waitForReady();

            if (!whatsappNumber) {
                console.error(`Phone number not found for ${contactName}`);
                return false;
            }

            const formattedNumber = this.formatPhoneNumber(whatsappNumber);
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

            // Wait for WhatsApp Web Store objects to be available
            await this.waitForWhatsAppStore();

            let contact;
            try {
                contact = await this.authClient.client.getContactById(formattedNumber);
                if (!contact) {
                    console.error(`Contact not found: ${contactName} (${formattedNumber})`);
                    return false;
                }
            } catch (contactError) {
                console.error(`Error getting contact ${contactName}:`, contactError);
                // Try to send message directly without contact validation
                console.log(`Attempting to send message directly to ${formattedNumber}`);
            }

            let finalMessage = message;
            if (processName && (!message || (typeof message === 'string' && message.trim() === ''))) {
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
            }

            const validFilePaths = await this.prepareFilePaths(filePaths);
            const perFileDelayMs = Number(options.perFileDelayMs || 1000);

            if (finalMessage) {
                let messageSent = false;
                let retryCount = 0;
                const maxRetries = 3;

                while (!messageSent && retryCount < maxRetries) {
                    try {
                        if (Array.isArray(finalMessage)) {
                            await this.authClient.client.sendMessage(formattedNumber, finalMessage.join('\n'));
                        } else {
                            await this.authClient.client.sendMessage(formattedNumber, finalMessage);
                        }
                        console.log(`Message sent to ${contactName}`);
                        messageSent = true;
                    } catch (messageError) {
                        retryCount++;
                        console.error(`Error sending message to ${contactName} (attempt ${retryCount}/${maxRetries}):`, messageError);
                        
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
                            
                            // Wait for Store objects to be available before retry
                            console.log(`Waiting for Store objects before retry ${retryCount + 1}/${maxRetries}`);
                            await this.waitForWhatsAppStore(10000); // Wait up to 10 seconds for Store
                        }
                    }
                }

                if (!messageSent) {
                    console.error(`Failed to send message to ${contactName} after ${maxRetries} attempts`);
                    return false;
                }
            }

            if (validFilePaths.length > 0) {
                for (const filePath of validFilePaths) {
                    try {
                        const media = MessageMedia.fromFilePath(filePath);
                        await this.authClient.client.sendMessage(formattedNumber, media);
                        console.log(`File sent: ${path.basename(filePath)}`);
                        
                        await new Promise(resolve => setTimeout(resolve, perFileDelayMs));
                    } catch (error) {
                        console.error(`Error sending file ${filePath}:`, error);
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

    async sendBulkMessages(contacts, message, filePaths = [], processName = 'salary_slip', options = {}) {
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

    async prepareFilePaths(filePaths, tempDir = null, isUpload = false) {
        try {
            if (!filePaths) return [];

            if (!Array.isArray(filePaths)) {
                filePaths = [filePaths];
            }

            const validPaths = [];
            const seenFilenames = new Set();

            for (const filePath of filePaths) {
                if (isUpload) {
                    if (filePath.filename) {
                        const tempPath = path.join(tempDir, filePath.filename);
                        await fs.promises.writeFile(tempPath, filePath.buffer);
                        validPaths.push(tempPath);
                        seenFilenames.add(filePath.filename);
                        console.log(`Saved uploaded file: ${tempPath}`);
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

            console.log(`Prepared ${validPaths.length} valid file paths`);
            return validPaths;
        } catch (error) {
            console.error('Error preparing file paths:', error);
            return [];
        }
    }

    async waitForWhatsAppStore(maxWaitMs = 30000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every 1 second
        
        console.log('Waiting for WhatsApp Web Store objects to be available...');
        
        while (Date.now() - startTime < maxWaitMs) {
            try {
                const page = this.authClient.client.pupPage;
                if (!page) {
                    throw new Error('Page not available');
                }
                
                const storeAvailable = await page.evaluate(() => {
                    return window.Store && window.Store.Msg && window.Store.Chat;
                });
                
                if (storeAvailable) {
                    console.log('WhatsApp Web Store objects are now available');
                    return true;
                }
                
                console.log('Store objects not yet available, waiting...');
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                
            } catch (error) {
                console.warn(`Error checking Store availability: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        
        console.warn(`Store objects not available after ${maxWaitMs}ms, proceeding anyway`);
        return false;
    }

    formatPhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        
        return cleaned + '@c.us';
    }
}

module.exports = { WhatsAppMessaging };
