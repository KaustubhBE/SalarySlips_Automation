const { WhatsAppServer } = require('./WhatsWeb.js');

const server = new WhatsAppServer(3001);

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
