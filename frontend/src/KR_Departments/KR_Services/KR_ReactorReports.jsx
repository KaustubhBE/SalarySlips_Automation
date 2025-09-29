import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Components/AuthContext';
import '../../Reports.css';
import { getApiUrl } from '../../config';
import LoadingSpinner from '../../LoadingSpinner';

const KR_ReactorReports = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Check if user has permission to access reactor reports
  const hasReactorReportsPermission = () => {
    if (!user) return false;
    
    const userRole = user.role || 'user';
    
    if (userRole === 'admin') return true;
    
    // Check for specific reactor reports permission using the enhanced hasPermission function
    return hasPermission('reactor_reports', 'kerur', 'operations');
  };


  // If user doesn't have permission, show access denied message
  if (!hasReactorReportsPermission()) {
    return (
      <div className="splash-page">
        <h1>Access Denied</h1>
        <p>You don't have permission to access Reactor Reports.</p>
        <p>Please contact your administrator if you believe this is an error.</p>
        <button onClick={() => navigate('/kerur')} className="nav-link">
          ← Back to Kerur Factory
        </button>
      </div>
    );
  }

  const handleDateChange = (e) => {
    setDate(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!date) {
      alert('Please select a date');
      return;
    }

    if (!sendWhatsapp && !sendEmail) {
      alert('Please select at least one notification method (WhatsApp or Email)');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();

      formData.append('send_email', sendEmail);
      formData.append('send_whatsapp', sendWhatsapp);
      formData.append('date', date);
      formData.append('process_name', 'kr_reactor-report');
      
      // Send Google tokens if available in session
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.google_access_token) {
        formData.append('google_access_token', user.google_access_token);
      }
      if (user.google_refresh_token) {
        formData.append('google_refresh_token', user.google_refresh_token);
      }

      const response = await fetch(getApiUrl('kr_reactor_reports'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Failed to generate reports' };
        }

        // Handle specific error types
        let errorMessage = 'Failed to generate reports';
        if (errorData?.error) {
          switch (errorData.error) {
            case 'USER_NOT_LOGGED_IN':
              errorMessage = 'Your session has expired. Please log in again.';
              // You can add logic here to redirect to login or show login modal
              break;
            case 'NO_SMTP_CREDENTIALS':
              errorMessage = 'Email credentials not found. Please check your settings.';
              break;
            case 'INVALID_RECIPIENT':
              errorMessage = 'Invalid recipient email address.';
              break;
            case 'NO_VALID_RECIPIENTS':
              errorMessage = 'No valid recipient emails found.';
              break;
            case 'SMTP_AUTH_FAILED':
              errorMessage = 'Email authentication failed. Please check your credentials.';
              break;
            case 'SMTP_ERROR':
              errorMessage = 'Email service error. Please try again later.';
              break;
            case 'EMAIL_SEND_ERROR':
              errorMessage = 'Failed to send email. Please try again.';
              break;
            case 'WHATSAPP_SERVICE_NOT_READY':
              errorMessage = 'WhatsApp service is not ready. Please try again later.';
              break;
            case 'INVALID_FILE_PATH':
              errorMessage = 'Invalid file path for WhatsApp message.';
              break;
            case 'INVALID_FILE_PATH_TYPE':
              errorMessage = 'Invalid file path type for WhatsApp message.';
              break;
            case 'NO_VALID_FILES':
              errorMessage = 'No valid files found for WhatsApp message.';
              break;
            case 'NO_FILES_FOR_UPLOAD':
              errorMessage = 'No files available for WhatsApp upload.';
              break;
            case 'WHATSAPP_API_ERROR':
              errorMessage = 'WhatsApp API error. Please try again later.';
              break;
            case 'WHATSAPP_CONNECTION_ERROR':
              errorMessage = 'WhatsApp connection error. Please try again later.';
              break;
            case 'WHATSAPP_TIMEOUT_ERROR':
              errorMessage = 'WhatsApp timeout error. Please try again later.';
              break;
            case 'WHATSAPP_SEND_ERROR':
              errorMessage = 'Failed to send WhatsApp message. Please try again.';
              break;
            case 'NO_RECIPIENTS_DATA':
              errorMessage = 'No recipients data provided for reactor report.';
              break;
            case 'MISSING_REQUIRED_COLUMNS':
              errorMessage = 'Required columns for WhatsApp notifications not found.';
              break;
            case 'NO_SUCCESSFUL_NOTIFICATIONS':
              errorMessage = 'No WhatsApp notifications were sent successfully.';
              break;
            case 'REACTOR_NOTIFICATION_ERROR':
              errorMessage = 'Error processing reactor report notifications.';
              break;
            case 'NO_GMAIL_ACCESS':
              errorMessage = 'You do not have Gmail access. Please contact your administrator.';
              break;
            case 'NO_GOOGLE_ACCESS_TOKEN':
              errorMessage = 'No Google access token found. Please re-authenticate with Google.';
              break;
            case 'GMAIL_AUTH_FAILED':
              errorMessage = 'Gmail authentication failed. Please re-authenticate with Google.';
              break;
            case 'GMAIL_PERMISSION_DENIED':
              errorMessage = 'Gmail permission denied. Please check your Gmail permissions.';
              break;
            case 'GMAIL_API_ERROR':
              errorMessage = 'Gmail API error. Please try again later.';
              break;
            case 'GMAIL_SEND_ERROR':
              errorMessage = 'Gmail send error. Please try again.';
              break;
            default:
              errorMessage = errorData.message || errorData.error || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Show detailed log report
      showDetailedLogReport(result);

      setSendEmail(false);
      setSendWhatsapp(false);
      setDate(new Date().toISOString().split('T')[0]);

      window.location.reload();

    } catch (error) {
      console.error('Error generating reports:', error);
      alert(error.message || 'Failed to generate reports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showDetailedLogReport = (result) => {
    const stats = result.delivery_stats || {};
    
    // Create simple alert message with basic stats
    const totalRecipients = stats.total_recipients || 0;
    const successfulDeliveries = stats.successful_deliveries || 0;
    const failedDeliveries = stats.failed_deliveries || 0;
    
    const alertMessage = `📊 Delivery Summary:
    
📋 Total contacts: ${totalRecipients}
✅ Successful messages: ${successfulDeliveries}
❌ Failed messages: ${failedDeliveries}
📊 Success rate: ${totalRecipients > 0 ? ((successfulDeliveries / totalRecipients) * 100).toFixed(1) : 0}%`;
    
    alert(alertMessage);
  };

  return (
    <div className="reports-container">
      {/* Loading Spinner */}
      {isLoading && <LoadingSpinner />}
      
      {/* Back Button Section - Consistent across all pages */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '10px 0',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <button 
          onClick={() => navigate('/kerur/kr_operations')} 
          className="back-button"
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#5a6268'
            e.target.style.transform = 'translateY(-1px)'
          }}
          onMouseOut={(e) => {
            e.target.style.background = '#6c757d'
            e.target.style.transform = 'translateY(0)'
          }}
        >
          ← Back to Department
        </button>
      </div>
      
      <h1>Reactor Reports</h1>

      <div className="sheet-id-section">
        <div className="sheet-inputs">
          <div className="sheet-input-group">
            <label htmlFor="date">Charging Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={handleDateChange}
              className="sheet-input"
              required
            />
          </div>
        </div>
      </div>

      <div className="notification-section">
        <h2>Notification Methods</h2>
        <div className="toggle-container">
          <div className="toggle-item">
            <label className="toggle">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">Send via Email</span>
          </div>

          <div className="toggle-item">
            <label className="toggle">
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">Send via WhatsApp</span>
          </div>
        </div>
      </div>

      <div className="button-group">
        <button
          className="submit-button"
          onClick={handleSubmit}
          disabled={isLoading || (!sendWhatsapp && !sendEmail)}
        >
          {isLoading ? 'Generating Reports...' : 'Generate Reports'}
        </button>
        
      </div>
    </div>
  );
};

export default KR_ReactorReports;
