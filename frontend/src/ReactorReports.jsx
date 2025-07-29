import React, { useState, useCallback } from 'react';
import './Reports.css';
import { getApiUrl } from './config';

const ReactorReports = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const validateSheetId = (id) => {
    const sheetIdRegex = /^[a-zA-Z0-9-_]{44}$/;
    return sheetIdRegex.test(id);
  };

  const extractSheetId = (url) => {
    try {
      let sheetId = url;
      if (url.includes('docs.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]{44})/);
        if (match && match[1]) {
          sheetId = match[1];
        }
      }
      return sheetId;
    } catch (error) {
      console.error('Error extracting sheet ID:', error);
      return url;
    }
  };

  const handleDailySheetIdChange = (e) => {
    const value = e.target.value.trim();
    const extractedId = extractSheetId(value);
    setDailySheetID(extractedId);

    if (extractedId && !validateSheetId(extractedId)) {
      setSheetError('Invalid Google Sheet ID format');
    } else {
      setSheetError('');
    }
  };

  const handleSheetIdChange = (e) => {
    const value = e.target.value.trim();
    const extractedId = extractSheetId(value);
    setSheetId(extractedId);

    if (extractedId && !validateSheetId(extractedId)) {
      setSheetError('Invalid Google Sheet ID format');
    } else {
      setSheetError('');
    }
  };

  const handleSheetNameChange = (e) => {
    setSheetName(e.target.value);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
  };

  const handleCopyServiceAccount = useCallback(() => {
    const serviceAccountEmail = "ems-974@be-ss-automation-445106.iam.gserviceaccount.com";
    navigator.clipboard.writeText(serviceAccountEmail).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!dailySheetID) {
      setSheetError('Daily Sheet ID is required');
      return;
    }

    if (!validateSheetId(dailySheetID)) {
      setSheetError('Invalid Daily Sheet ID format');
      return;
    }

    if (!sheetId) {
      setSheetError('Google Sheet ID is required');
      return;
    }

    if (!validateSheetId(sheetId)) {
      setSheetError('Invalid Google Sheet ID format');
      return;
    }

    if (!sheetName) {
      alert('Please enter the sheet name');
      return;
    }

    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (!sendEmail) {
      alert('Please select at least one notification method (Email)');
      return;
    }

    const messageItems = previewItems.filter(item => item.file_type === 'message');
    if (messageItems.length === 0) {
      alert('Please add at least one message template');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();

      formData.append('send_email', sendEmail);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);

      const response = await fetch(getApiUrl('reactor-reports'), {
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

        throw new Error(errorData.error || 'Failed to generate reports');
      }

      const result = await response.json();
      alert(result.message || 'Reports generated and sent successfully!');

      setTemplateFiles([]);
      setAttachmentFiles([]);
      setDailySheetID('');
      setSheetId('');
      setSheetName('');
      setSendEmail(false);
      setMailSubject('');
      setPreviewItems([]);
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);

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
            <label htmlFor="start-date">Start Date</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={handleStartDateChange}
              className="sheet-input"
              required
            />
          </div>

          <div className="sheet-input-group">
            <label htmlFor="end-date">End Date</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={handleEndDateChange}
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
        </div>
      </div>

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={previewItems.filter(item => item.file_type === 'message').length === 0 || !sheetId || !!sheetError || isLoading || !sendEmail}
      >
        {isLoading ? 'Generating Reports...' : 'Generate Reports'}
      </button>
    </div>
  );
};

export default ReactorReports;
