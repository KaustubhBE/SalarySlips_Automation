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

            // Wait for WhatsApp Web Store objects to be available (with timeout)
            console.log('Waiting for WhatsApp Web Store objects to be available...');
            await this.waitForWhatsAppStore(120000); // Wait up to 2 minutes for proper initialization

            let contact;
            try {
                // Check if page is available before trying to get contact
                const page = this.authClient.client.pupPage;
                if (!page) {
                    console.log(`Page not available, attempting to send message directly to ${formattedNumber}`);
                } else {
                    // First, let's test what the WhatsApp Web library is actually trying to access
                    const testResult = await page.evaluate(() => {
                        try {
                            // Test the exact same code that whatsapp-web.js is trying to execute
                            const result = {
                                storeExists: !!window.Store,
                                contactStoreExists: !!(window.Store && window.Store.Contact),
                                getContactExists: !!(window.Store && window.Store.Contact && window.Store.Contact.get),
                                getContactType: window.Store && window.Store.Contact && window.Store.Contact.get ? typeof window.Store.Contact.get : 'undefined',
                                storeKeys: window.Store ? Object.keys(window.Store) : [],
                                contactKeys: window.Store && window.Store.Contact ? Object.keys(window.Store.Contact) : []
                            };
                            
                            // Try to actually call the function and check if it's properly initialized
                            if (window.Store && window.Store.Contact && window.Store.Contact.get) {
                                try {
                                    const testCall = window.Store.Contact.get('test@c.us');
                                    result.testCallSuccess = true;
                                    result.testCallResult = 'success';
                                } catch (e) {
                                    result.testCallError = e.message;
                                    result.testCallSuccess = false;
                                    
                                    // Check if it's a proper WhatsApp error (function is working) or an undefined error (function not ready)
                                    if (e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties')) {
                                        result.testCallResult = 'whatsapp_error'; // Function is working but WhatsApp returned an error
                                    } else {
                                        result.testCallResult = 'function_not_ready'; // Function is not properly initialized
                                    }
                                }
                            } else {
                                result.testCallResult = 'function_not_available';
                            }
                            
                            return result;
                        } catch (e) {
                            return { error: e.message };
                        }
                    });
                    
                    console.log('WhatsApp Web Store test result:', JSON.stringify(testResult, null, 2));
                    
                    // Only try to get contact if Store objects are properly initialized
                    if (testResult.testCallResult === 'success' || testResult.testCallResult === 'whatsapp_error') {
                        contact = await this.authClient.client.getContactById(formattedNumber);
                        if (!contact) {
                            console.error(`Contact not found: ${contactName} (${formattedNumber})`);
                            return false;
                        }
                    } else {
                        console.log(`Store objects not ready for contact lookup, proceeding with direct messaging to ${formattedNumber}`);
                    }
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
                        // Test WhatsApp Web Store objects before sending message
                        const page = this.authClient.client.pupPage;
                        let sendTestResult = null;
                        
                        if (page) {
                            sendTestResult = await page.evaluate(() => {
                                try {
                                    const result = {
                                        storeExists: !!window.Store,
                                        chatStoreExists: !!(window.Store && window.Store.Chat),
                                        getChatExists: !!(window.Store && window.Store.Chat && window.Store.Chat.get),
                                        getChatType: window.Store && window.Store.Chat && window.Store.Chat.get ? typeof window.Store.Chat.get : 'undefined',
                                        storeKeys: window.Store ? Object.keys(window.Store) : [],
                                        chatKeys: window.Store && window.Store.Chat ? Object.keys(window.Store.Chat) : []
                                    };
                                    
                                    // Try to actually call the function and check if it's properly initialized
                                    if (window.Store && window.Store.Chat && window.Store.Chat.get) {
                                        try {
                                            const testCall = window.Store.Chat.get('test@c.us');
                                            result.testCallSuccess = true;
                                            result.testCallResult = 'success';
                                        } catch (e) {
                                            result.testCallError = e.message;
                                            result.testCallSuccess = false;
                                            
                                            // Check if it's a proper WhatsApp error (function is working) or an undefined error (function not ready)
                                            if (e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties')) {
                                                result.testCallResult = 'whatsapp_error'; // Function is working but WhatsApp returned an error
                                            } else {
                                                result.testCallResult = 'function_not_ready'; // Function is not properly initialized
                                            }
                                        }
                                    } else {
                                        result.testCallResult = 'function_not_available';
                                    }
                                    
                                    return result;
                                } catch (e) {
                                    return { error: e.message };
                                }
                            });
                            
                            console.log('WhatsApp Web Store test result for sendMessage:', JSON.stringify(sendTestResult, null, 2));
                        }
                        
                        // Only proceed with sending if Store objects are properly initialized
                        if (!sendTestResult || sendTestResult.testCallResult === 'success' || sendTestResult.testCallResult === 'whatsapp_error') {
                            if (Array.isArray(finalMessage)) {
                                await this.authClient.client.sendMessage(formattedNumber, finalMessage.join('\n'));
                            } else {
                                await this.authClient.client.sendMessage(formattedNumber, finalMessage);
                            }
                        } else {
                            // If Store objects aren't ready, try a different approach
                            console.log(`Store objects not ready (${sendTestResult.testCallResult}), attempting direct messaging...`);
                            
                            // Wait a bit more and try again
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            
                            // Try to send message directly without Store validation
                            if (Array.isArray(finalMessage)) {
                                await this.authClient.client.sendMessage(formattedNumber, finalMessage.join('\n'));
                            } else {
                                await this.authClient.client.sendMessage(formattedNumber, finalMessage);
                            }
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
                            
                            // Wait for Store objects before retry
                            console.log(`Waiting for Store objects before retry ${retryCount + 1}/${maxRetries}`);
                            await this.waitForWhatsAppStore(30000); // Wait up to 30 seconds for retry
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
        
        console.log(`Waiting for WhatsApp Web Store objects to be available (max ${maxWaitMs/1000}s)...`);
        
        while (Date.now() - startTime < maxWaitMs) {
            try {
                const page = this.authClient.client.pupPage;
                if (!page) {
                    console.log('Page not available, waiting...');
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                    continue;
                }
                
                const storeStatus = await page.evaluate(() => {
                    const storeExists = !!window.Store;
                    const msgExists = !!(window.Store && window.Store.Msg);
                    const chatExists = !!(window.Store && window.Store.Chat);
                    
                    // Test if the actual functions are available and working
                    let getContactWorks = false;
                    let getChatWorks = false;
                    let contactStoreExists = false;
                    let chatStoreExists = false;
                    let contactGetFunctionExists = false;
                    let chatGetFunctionExists = false;
                    
                    try {
                        if (window.Store && window.Store.Contact) {
                            contactStoreExists = true;
                            contactGetFunctionExists = typeof window.Store.Contact.get === 'function';
                            
                            // Test if the function is actually callable (not just defined)
                            if (contactGetFunctionExists) {
                                try {
                                    // Try to call the function with a dummy parameter to see if it's properly initialized
                                    const testResult = window.Store.Contact.get('test@c.us');
                                    getContactWorks = true; // If no error, it's working
                                } catch (e) {
                                    // If it throws an error but it's a WhatsApp-specific error (not undefined), it's working
                                    getContactWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getContact');
                                }
                            }
                        }
                    } catch (e) {
                        getContactWorks = false;
                    }
                    
                    try {
                        if (window.Store && window.Store.Chat) {
                            chatStoreExists = true;
                            chatGetFunctionExists = typeof window.Store.Chat.get === 'function';
                            
                            // Test if the function is actually callable (not just defined)
                            if (chatGetFunctionExists) {
                                try {
                                    // Try to call the function with a dummy parameter to see if it's properly initialized
                                    const testResult = window.Store.Chat.get('test@c.us');
                                    getChatWorks = true; // If no error, it's working
                                } catch (e) {
                                    // If it throws an error but it's a WhatsApp-specific error (not undefined), it's working
                                    getChatWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getChat');
                                }
                            }
                        }
                    } catch (e) {
                        getChatWorks = false;
                    }
                    
                    // Check if WhatsApp Web interface is actually loaded
                    const whatsappLoaded = document.title.includes('WhatsApp') || 
                                         document.body.innerHTML.includes('WhatsApp') ||
                                         !!document.querySelector('[data-testid="chat-list"]') ||
                                         !!document.querySelector('#main');
                    
                    // Get more detailed Store object information
                    let storeDetails = {};
                    try {
                        if (window.Store) {
                            storeDetails = {
                                hasContact: !!window.Store.Contact,
                                hasChat: !!window.Store.Chat,
                                hasMsg: !!window.Store.Msg,
                                contactMethods: window.Store.Contact ? Object.getOwnPropertyNames(window.Store.Contact) : [],
                                chatMethods: window.Store.Chat ? Object.getOwnPropertyNames(window.Store.Chat) : [],
                                storeKeys: Object.getOwnPropertyNames(window.Store),
                                contactGetType: window.Store.Contact ? typeof window.Store.Contact.get : 'undefined',
                                chatGetType: window.Store.Chat ? typeof window.Store.Chat.get : 'undefined'
                            };
                        }
                    } catch (e) {
                        storeDetails = { error: e.message };
                    }
                    
                    return {
                        storeExists,
                        msgExists,
                        chatExists,
                        contactStoreExists,
                        chatStoreExists,
                        contactGetFunctionExists,
                        chatGetFunctionExists,
                        getContactWorks,
                        getChatWorks,
                        whatsappLoaded,
                        storeDetails,
                        allLoaded: storeExists && msgExists && chatExists && getContactWorks && getChatWorks && whatsappLoaded
                    };
                });
                
                if (storeStatus.allLoaded) {
                    const elapsed = Date.now() - startTime;
                    console.log(`✅ WhatsApp Web Store objects are now available after ${elapsed}ms`);
                    return true;
                }
                
                const elapsed = Date.now() - startTime;
                console.log(`Store objects not ready yet (${elapsed}ms): Store=${storeStatus.storeExists}, Msg=${storeStatus.msgExists}, Chat=${storeStatus.chatExists}, ContactStore=${storeStatus.contactStoreExists}, ChatStore=${storeStatus.chatStoreExists}, contactGetFunc=${storeStatus.contactGetFunctionExists}, chatGetFunc=${storeStatus.chatGetFunctionExists}, getContact=${storeStatus.getContactWorks}, getChat=${storeStatus.getChatWorks}, whatsappLoaded=${storeStatus.whatsappLoaded}`);
                console.log(`Store details:`, JSON.stringify(storeStatus.storeDetails, null, 2));
                
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                
            } catch (error) {
                console.warn(`Error checking Store availability: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        
        const totalElapsed = Date.now() - startTime;
        console.warn(`⚠️ Store objects not available after ${totalElapsed}ms, attempting page refresh...`);
        
        // Try to refresh the WhatsApp Web page
        try {
            const page = this.authClient.client.pupPage;
            if (page) {
                console.log('Refreshing WhatsApp Web page...');
                await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
                console.log('Page refreshed, waiting 10 seconds for WhatsApp Web to reload...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                // Check again after refresh with more thorough validation
                const refreshedStatus = await page.evaluate(() => {
                    const storeExists = !!window.Store;
                    const msgExists = !!(window.Store && window.Store.Msg);
                    const chatExists = !!(window.Store && window.Store.Chat);
                    
                    let getContactWorks = false;
                    let getChatWorks = false;
                    
                    try {
                        if (window.Store && window.Store.Contact && typeof window.Store.Contact.get === 'function') {
                            try {
                                const testResult = window.Store.Contact.get('test@c.us');
                                getContactWorks = true;
                            } catch (e) {
                                getContactWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getContact');
                            }
                        }
                    } catch (e) {
                        getContactWorks = false;
                    }
                    
                    try {
                        if (window.Store && window.Store.Chat && typeof window.Store.Chat.get === 'function') {
                            try {
                                const testResult = window.Store.Chat.get('test@c.us');
                                getChatWorks = true;
                            } catch (e) {
                                getChatWorks = e.message && !e.message.includes('undefined') && !e.message.includes('Cannot read properties') && !e.message.includes('getChat');
                            }
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
                
                if (refreshedStatus.allLoaded) {
                    console.log('✅ WhatsApp Web Store objects are now available after page refresh');
                    return true;
                } else {
                    console.warn('⚠️ Store objects still not available after page refresh, proceeding anyway');
                }
            }
        } catch (refreshError) {
            console.warn(`Error refreshing page: ${refreshError.message}`);
        }
        
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
