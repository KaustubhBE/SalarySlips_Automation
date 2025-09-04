const { WhatsAppServer } = require('./WhatsWeb.js');

// Create server instance binding to all interfaces for domain access
const server = new WhatsAppServer(8092, '0.0.0.0');

server.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down WhatsApp server...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down WhatsApp server...');
    await server.stop();
    process.exit(0);
});
