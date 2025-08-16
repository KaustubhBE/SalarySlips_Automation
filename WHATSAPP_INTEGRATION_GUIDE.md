# WhatsApp Integration Guide

## Overview
This document explains how the WhatsApp functionality is integrated between the Python backend (`app.py`, `process_utils.py`), the WhatsApp utilities (`whatsapp_utils.py`), and the Node.js WhatsApp service (`WhatsWeb.js`).

## Architecture

### 1. Frontend Components
- **`Navbar.jsx`**: Handles WhatsApp QR code generation and authentication
- **`Reports.jsx`**: Sends reports via WhatsApp and Email
- **`ReactorReports.jsx`**: Sends reactor reports via WhatsApp and Email

### 2. Python Backend
- **`app.py`**: Main Flask application with API endpoints
- **`process_utils.py`**: Core processing logic for salary slips and reports
- **`whatsapp_utils.py`**: Python client for Node.js WhatsApp service

### 3. Node.js WhatsApp Service
- **`WhatsWeb.js`**: WhatsApp service implementation using whatsapp-web.js
- **`start.js`**: Service startup script

## Data Flow

### 1. WhatsApp Authentication Flow
```
Frontend (Navbar.jsx) → WhatsApp Service (/trigger-login) → WhatsApp Web → QR Code → Frontend Display
```

### 2. Message Sending Flow
```
Frontend → Python Backend → whatsapp_utils.py → Node.js Service → WhatsApp Web → Recipient
```

## Key Functions

### Python Side (`whatsapp_utils.py`)

#### `WhatsAppNodeClient` Class
- **`check_service_health()`**: Verifies WhatsApp service is running
- **`get_status()`**: Gets current WhatsApp status
- **`trigger_login()`**: Triggers QR code generation
- **`send_whatsapp_message()`**: Sends messages via Node service

#### Specialized Functions
- **`handle_whatsapp_notification()`**: For salary slip notifications
- **`handle_reactor_report_notification()`**: For reactor report notifications
- **`send_bulk_whatsapp_messages()`**: For bulk messaging

### Node.js Side (`WhatsWeb.js`)

#### `WhatsAppService` Class
- **`triggerLogin()`**: Generates QR codes on demand
- **`sendWhatsAppMessage()`**: Sends messages with attachments
- **`waitForReady()`**: Waits for WhatsApp client to be ready

#### API Endpoints
- **`/trigger-login`**: Generate QR code
- **`/send-message`**: Send single message
- **`/send-bulk`**: Send bulk messages
- **`/send-salary-notification`**: Send salary slip notifications
- **`/send-reactor-report`**: Send reactor report notifications
- **`/send-general-report`**: Send general report notifications

## Process Types

### 1. `salary_slip`
- Sends message first, then files
- Used for salary slip notifications
- 1-second delay between files

### 2. `report`
- Sends items in sequence order
- Used for general reports with file sequencing
- 2-second delay between items

### 3. `reactor_report`
- Sends message first, then files
- Used for reactor report notifications
- 1-second delay between files

## Making Future Updates

### 1. Adding New Process Types

#### Step 1: Update `WhatsAppService.sendWhatsAppMessage()` in `WhatsWeb.js`
```javascript
} else if (processName === 'new_process_type') {
    // Add your custom logic here
    // Example: Send message first, then files with custom delays
    if (message) {
        await this.client.sendMessage(formattedNumber, message);
    }
    
    for (const filePath of validFilePaths) {
        const media = MessageMedia.fromFilePath(filePath);
        await this.client.sendMessage(formattedNumber, media);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Custom delay
    }
}
```

#### Step 2: Add New API Endpoint in `WhatsWeb.js`
```javascript
// Route for new process type
this.app.post('/send-new-process', this.upload.array('files'), async (req, res) => {
    try {
        const { contact_name, message, whatsapp_number, custom_param } = req.body;
        const filePaths = req.files ? req.files.map(file => file.path) : [];
        
        const result = await this.whatsappService.sendWhatsAppMessage(
            contact_name,
            message,
            filePaths,
            [],
            whatsapp_number,
            'new_process_type'
        );
        
        res.json({ success: result, contact_name });
    } catch (error) {
        console.error('Error in /send-new-process:', error);
        res.status(500).json({ error: error.message });
    }
});
```

#### Step 3: Add New Function in `whatsapp_utils.py`
```python
def handle_new_process_notification(contact_name: str, message: str, 
                                  file_paths: List[str], whatsapp_number: str) -> bool:
    """
    Handle WhatsApp notification for new process type
    """
    client = WhatsAppNodeClient()
    
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return False
    
    try:
        # Prepare request data
        data = {
            'contact_name': contact_name,
            'message': message,
            'whatsapp_number': whatsapp_number,
            'custom_param': 'value'
        }
        
        # Prepare files for upload
        files = []
        for file_path in file_paths:
            if os.path.exists(file_path):
                files.append(('files', open(file_path, 'rb')))
        
        # Send request
        response = requests.post(
            f"{client.base_url}/send-new-process",
            data=data,
            files=files,
            timeout=client.timeout
        )
        
        # Close file handles
        for _, file_handle in files:
            file_handle.close()
        
        if response.status_code == 200:
            result = response.json()
            return result.get('success', False)
        else:
            logging.error(f"Error sending new process notification: {response.status_code}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending new process notification: {str(e)}")
        return False
```

### 2. Adding New Message Types

#### Step 1: Update Frontend Component
```jsx
const [newMessageType, setNewMessageType] = useState(false);

// Add to form submission
formData.append('new_message_type', newMessageType);
```

#### Step 2: Update Python Backend
```python
@app.route("/api/new-endpoint", methods=["POST"])
def new_endpoint():
    try:
        new_message_type = request.form.get('new_message_type') == 'true'
        
        if new_message_type:
            # Handle new message type
            success = handle_new_process_notification(...)
        
        return jsonify({"message": "Success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

### 3. Adding New File Handling

#### Step 1: Update File Validation in Frontend
```jsx
const validFiles = selectedFiles.filter(file => {
    const fileType = file.type;
    const isValidType = 
        fileType === 'text/plain' || 
        fileType === 'application/pdf' ||
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'image/png' ||
        fileType === 'image/jpeg' ||
        fileType === 'image/jpg' ||
        fileType === 'application/zip' || // New file type
        fileType === 'application/x-rar-compressed'; // New file type
    
    if (!isValidType) {
        alert(`File type not supported: ${file.name}`);
    }
    return isValidType;
});
```

#### Step 2: Update Node.js Service if Needed
```javascript
// In WhatsAppService.sendWhatsAppMessage()
if (filePath.endsWith('.zip') || filePath.endsWith('.rar')) {
    // Handle compressed files differently
    console.log(`Sending compressed file: ${path.basename(filePath)}`);
    // Add custom logic for compressed files
}
```

## Error Handling

### 1. Service Health Checks
- Always check `client.check_service_health()` before sending messages
- Log errors with context for debugging
- Return appropriate error responses

### 2. File Validation
- Validate file existence before processing
- Handle missing files gracefully
- Log warnings for invalid files

### 3. Network Errors
- Use appropriate timeouts
- Retry logic for failed requests
- Graceful degradation when service is unavailable

## Testing

### 1. Test WhatsApp Service
```bash
cd whatsappweb-service
npm start
```

### 2. Test Python Integration
```python
from Utils.whatsapp_utils import WhatsAppNodeClient

client = WhatsAppNodeClient()
print(client.check_service_health())
print(client.get_status())
```

### 3. Test Frontend
- Open browser console
- Check network requests
- Verify QR code generation
- Test message sending

## Best Practices

### 1. Code Organization
- Keep WhatsApp logic in `whatsapp_utils.py`
- Use consistent naming conventions
- Add proper error handling and logging

### 2. Performance
- Use appropriate delays between messages
- Batch operations when possible
- Clean up temporary files

### 3. Security
- Validate all inputs
- Use environment variables for sensitive data
- Implement proper authentication

### 4. Monitoring
- Log all WhatsApp operations
- Track success/failure rates
- Monitor service health

## Troubleshooting

### Common Issues

1. **QR Code Not Generating**
   - Check WhatsApp service is running
   - Verify service health endpoint
   - Check browser console for errors

2. **Messages Not Sending**
   - Verify WhatsApp client is ready
   - Check file paths and permissions
   - Review error logs

3. **Service Connection Issues**
   - Verify port 3001 is accessible
   - Check CORS configuration
   - Verify network connectivity

### Debug Commands

```bash
# Check WhatsApp service status
curl http://localhost:3001/health

# Check service logs
tail -f whatsappweb-service/logs/app.log

# Test specific endpoint
curl -X POST http://localhost:3001/trigger-login
```

This integration is designed to be flexible and maintainable, allowing you to easily add new features while maintaining consistency across the system.
