import React, { useState, useEffect, useRef } from 'react';

const MessageLogger = ({ refreshTrigger }) => {
    const [messages, setMessages] = useState([]);
    const logEndRef = useRef(null);

    // Fetch logs from the backend
    const fetchLogs = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/get-logs');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const logText = await response.text();
            const logLines = logText.split('\n').filter(line => line.trim() !== '');
            setMessages(logLines); // Update the messages state with logs from the backend
            console.log('Fetched logs:', logLines); // Debugging log
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    // Fetch logs when refreshTrigger changes
    useEffect(() => {
        fetchLogs(); // Fetch logs immediately when refreshTrigger changes
    }, [refreshTrigger]);

    // Auto-scroll to the bottom of the log container when messages change
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            backgroundColor: '#f8f9fa',
            padding: '10px',
            borderTop: '1px solid #ddd',
            zIndex: 1000,
        }}>
            <h4>Message Log</h4>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ marginBottom: '5px', color: '#dc3545' }}>
                        {msg}
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>
    );
};

export default MessageLogger;