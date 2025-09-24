import React, { useState } from 'react';
import './Reports.css';
import { getApiUrl } from './config';

const ReactorReports = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

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

      const response = await fetch(getApiUrl('reactor_reports'), {
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
            default:
              errorMessage = errorData.message || errorData.error || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      alert(result.message || 'Reports generated and sent successfully!');

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

  return (
    <div className="reports-container">
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

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={isLoading || (!sendWhatsapp && !sendEmail)}
      >
        {isLoading ? 'Generating Reports...' : 'Generate Reports'}
      </button>
    </div>
  );
};

export default ReactorReports;
