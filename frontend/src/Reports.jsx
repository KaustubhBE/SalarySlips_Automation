import React, { useState, useCallback, useEffect } from 'react';
import './Reports.css';
import { getApiUrl } from './config';

const Reports = () => {
  const [templateFiles, setTemplateFiles] = useState([]);
  const [attachmentFiles, setAttachmentFiles] = useState({});
  const [isDraggingTemplate, setIsDraggingTemplate] = useState(false);
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [sheetError, setSheetError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [mailSubject, setMailSubject] = useState('');

  // Helper to get file type as a string
  const getFileType = (file) => {
    if (file.type === 'text/plain') return 'message';
    return 'file';
  };

  // Function to get template file content
  const getTemplateFileContent = useCallback(async (templateFile) => {
    if (!templateFile) return null;

    try {
      const formData = new FormData();
      formData.append('file', templateFile);

      const apiUrl = getApiUrl('preview-file');
      console.log('Sending preview request to:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to preview file' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw content from server for preview:', data.content);

      if (!data.content) {
        throw new Error('No content received from server');
      }
      return data.content.split('\n').map(line => line.trim()).join('\n');
    } catch (error) {
      console.error('Error getting template content:', error);
      return `Error loading template: ${error.message}`;
    }
  }, []);

  // Function to build and set previewItems based on current templateFiles and attachmentFiles
  const buildAndSetPreviewItems = useCallback(async (currentTemplateFiles, currentAttachmentFiles) => {
    let items = [];
    let sequenceNo = 1;  // Start with sequence number 1

    // Add template file if exists
    if (currentTemplateFiles.length > 0) {
      const content = await getTemplateFileContent(currentTemplateFiles[0]);
      if (content) {
        items.push({
          file_name: currentTemplateFiles[0].name,
          file_type: 'message',
          sequence_no: sequenceNo,
          content: content, // Re-added for UI display
          file: currentTemplateFiles[0] // Re-added for internal logic/UI display
        });
        sequenceNo++;
      }
    }

    // Add attachment files
    Object.values(currentAttachmentFiles).forEach(obj => {
      items.push({
        file_name: obj.file.name,
        file_type: obj.type === 'text' ? 'message' : 'file',
        sequence_no: sequenceNo,
        content: `[${obj.file.name}] (${obj.type})`, // Re-added for UI display
        file: obj.file // Re-added for internal logic/UI display
      });
      sequenceNo++;
    });

    setPreviewItems(items);
    setPreviewTitle(items.length > 0 ? 'Content Preview' : 'Preview');
  }, [getTemplateFileContent]);

  // Initial build of preview items when component mounts or files change
  useEffect(() => {
    buildAndSetPreviewItems(templateFiles, attachmentFiles);
  }, [templateFiles, attachmentFiles, buildAndSetPreviewItems]);

  const handleDragEnter = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'template') {
      setIsDraggingTemplate(true);
    } else {
      setIsDraggingAttachment(true);
    }
  }, []);

  const handleDragLeave = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'template') {
      setIsDraggingTemplate(false);
    } else {
      setIsDraggingAttachment(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (type === 'template') {
      setIsDraggingTemplate(false);
    } else {
      setIsDraggingAttachment(false);
    }

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const fileType = file.type;
      const isValidType = 
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      
      if (!isValidType) {
        alert(`File type not supported: ${file.name}. Please upload only .docx`);
      }
      return isValidType;
    });

    if (type === 'template') {
      if (validFiles.length > 1) {
        alert('Only one template file can be uploaded');
        return;
      }
      setTemplateFiles(validFiles);
      await buildAndSetPreviewItems(validFiles, attachmentFiles); // Update preview immediately
    } else {
      setAttachmentFiles(prevFiles => {
        const newFiles = { ...prevFiles };
        let maxKey = Object.keys(newFiles).length > 0 ? Math.max(...Object.keys(newFiles).map(Number)) : 0;
        validFiles.forEach(file => {
          maxKey += 1;
          newFiles[maxKey] = { file, type: getFileType(file) };
        });
        buildAndSetPreviewItems(templateFiles, newFiles); // Update preview immediately
        return newFiles;
      });
    }
  }, [templateFiles, attachmentFiles, buildAndSetPreviewItems, getFileType]); // Add dependencies for handleFilePreview, templateFiles and attachmentFiles

  const handleFileInput = (e, type) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const fileType = file.type;
      const isValidType = 
        fileType === 'text/plain' || 
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'image/png' ||
        fileType === 'image/jpeg' ||
        fileType === 'image/jpg' ||
        fileType === 'application/pdf';
      
      if (!isValidType) {
        alert(`File type not supported: ${file.name}. Please upload only .txt, .docx, .png, .jpg, .jpeg, or .pdf files.`);
      }
      return isValidType;
    });

    if (type === 'template') {
      if (validFiles.length > 1) {
        alert('Only one template file can be uploaded');
        return;
      }
      setTemplateFiles(validFiles);
      buildAndSetPreviewItems(validFiles, attachmentFiles); // Update preview immediately
    } else {
      setAttachmentFiles(prevFiles => {
        const newFiles = { ...prevFiles };
        let maxKey = Object.keys(newFiles).length > 0 ? Math.max(...Object.keys(newFiles).map(Number)) : 0;
        validFiles.forEach(file => {
          maxKey += 1;
          newFiles[maxKey] = { file, type: getFileType(file) };
        });
        buildAndSetPreviewItems(templateFiles, newFiles); // Update preview immediately
        return newFiles;
      });
    }
  };

  const handleRemoveFile = (index, type) => {
    if (type === 'template') {
      setTemplateFiles([]); // Template is removed
      buildAndSetPreviewItems([], attachmentFiles); // Update preview immediately
    } else { // type === 'attachment'
      setAttachmentFiles(prevFiles => {
        const newFiles = { ...prevFiles };
        // Find the key in attachmentFiles corresponding to the item's original position
        const itemToRemove = previewItems.find(item => item.sequence_no === index + 1);
        if (itemToRemove && itemToRemove.file_type === 'file') {
            let keyToRemove = null;
            for (const key in prevFiles) {
                if (prevFiles[key].file.name === itemToRemove.file_name) {
                    keyToRemove = key;
                    break;
                }
            }
            if (keyToRemove) {
                delete newFiles[keyToRemove];
            }
        }

        const filesArr = Object.values(newFiles);
        const resequenced = {};
        filesArr.forEach((obj, i) => {
          resequenced[i + 1] = obj;
        });
        buildAndSetPreviewItems(templateFiles, resequenced); // Update preview immediately
        return resequenced;
      });
    }
  };

  const validateSheetId = (id) => {
    // Google Sheet ID is typically 20-100 characters long
    const sheetIdRegex = /^[a-zA-Z0-9-_]{44}$/;
    return sheetIdRegex.test(id);
  };

  const extractSheetId = (url) => {
    try {
      // Handle different Google20,100heets URL formats
      let sheetId = url;
      
      // If it's a complete URL
      if (url.includes('docs.google.com')) {
        // Extract ID from URL patterns like:
        // https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
        // https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=0
        const match = url.match(/\/d\/([a-zA-Z0-9-_]{44})/);
        if (match && match[1]) {
          sheetId = match[1];
        }
      }
      
      return sheetId;
    } catch (error) {
      console.error('Error extracting sheet ID:', error);
      return url; // Return original input if extraction fails
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

  const handleCopyServiceAccount = () => {
    navigator.clipboard.writeText('automation@be-ss-automation.iam.gserviceaccount.com');
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000); // Reset success message after 2 seconds
  };

  const handlePreviewDragStart = (e, index) => {
    setDraggedItem(previewItems[index]);
  };

  const handlePreviewDragOver = (e, index) => {
    e.preventDefault();
  };

  const handlePreviewDrop = (e, targetIndex) => {
    e.preventDefault();
    if (!draggedItem) return;

    const updatedItems = Array.from(previewItems);
    const draggedIndex = updatedItems.findIndex(item => item.sequence_no === draggedItem.sequence_no);
    const [reorderedItem] = updatedItems.splice(draggedIndex, 1);
    updatedItems.splice(targetIndex, 0, reorderedItem);

    // Re-sequence items after reordering
    const resequencedItems = updatedItems.map((item, index) => ({
      ...item,
      sequence_no: index + 1
    }));

    setPreviewItems(resequencedItems);
    setDraggedItem(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (previewItems.length === 0) {
      alert('Please add at least one item (message or file)');
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

    if (!sendWhatsapp && !sendEmail) {
      alert('Please select at least one notification method (WhatsApp or Email)');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      
      // Sort items by sequence number
      const sortedItems = [...previewItems].sort((a, b) => a.sequence_no - b.sequence_no);
      
      // Add files in sequence order
      sortedItems.forEach(item => {
        if (item.file_type === 'message') {
          // Find the template file by name
          const templateFile = templateFiles.find(file => file.name === item.file_name);
          if (templateFile) {
            formData.append('template_files', templateFile);
          }
        } else if (item.file_type === 'file') {
          // Find the attachment file by name
          const attachmentFile = Object.values(attachmentFiles).find(
            obj => obj.file.name === item.file_name
          );
          if (attachmentFile) {
            formData.append('attachment_files', attachmentFile.file);
          }
        }
      });

      // Add other required data
      formData.append('sheet_id', sheetId);
      formData.append('sheet_name', sheetName);
      formData.append('send_whatsapp', sendWhatsapp);
      formData.append('send_email', sendEmail);
      formData.append('mail_subject', mailSubject);

      // Add file sequencing information as a JSON string
      formData.append('file_sequence', JSON.stringify(sortedItems.map(item => ({
        file_name: item.file_name,
        file_type: item.file_type,
        sequence_no: item.sequence_no
      }))));

      // Send request to backend
      const response = await fetch(getApiUrl('send-reports'), {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type header when sending FormData
          // The browser will automatically set it with the correct boundary
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate reports');
      }

      const result = await response.json();
      
      // Show success message
      alert(result.message || 'Reports generated and sent successfully!');
      
      // Reset form
      setTemplateFiles([]);
      setAttachmentFiles([]);
      setSheetId('');
      setSheetName('');
      setSendWhatsapp(false);
      setSendEmail(false);
      setMailSubject('');
      setPreviewItems([]);
      
      // Refresh the page after successful submission
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
      <h1>Generate Reports</h1>
      
      {/* Email Subject at the top, full width */}
      <div className="full-width-input-group">
        <label htmlFor="mail-subject">Email Subject</label>
        <input
          type="text"
          id="mail-subject"
          value={mailSubject}
          onChange={e => setMailSubject(e.target.value)}
          placeholder="Enter Email Subject"
          className="full-width-input"
        />
      </div>

      <div className="drop-zones-container">
        <div 
          className={`drop-zone ${isDraggingTemplate ? 'dragging' : ''}`}
          onDragEnter={(e) => handleDragEnter(e, 'template')}
          onDragLeave={(e) => handleDragLeave(e, 'template')}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'template')}
        >
          <div className="drop-zone-content-template">
            <h3>Template Files</h3>
            <p>Drag and drop template files here</p>
            <p className="file-types">Supported formats: .docx</p>
            <div className="file-input-container">
              <input
                type="file"
                id="template-file-input"
                onChange={(e) => handleFileInput(e, 'template')}
                accept=".docx"
                style={{ display: 'none' }}
              />
              <button 
                className="browse-button"
                onClick={() => {
                  document.getElementById('template-file-input').click();
                  setShowTemplateDropdown(!showTemplateDropdown);
                }}
              >
                Browse Template Files
              </button>
              {showTemplateDropdown && (
                <div className="files-dropdown">
                  {templateFiles.length > 0 ? (
                    templateFiles.map((file, index) => (
                      <div key={`template-${index}`} className="file-item">
                        <span className="file-name" title={file.name}>
                          {file.name}
                        </span>
                        <button 
                          className="remove-button"
                          onClick={() => handleRemoveFile(index, 'template')}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="no-files">No files selected</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div 
          className={`drop-zone ${isDraggingAttachment ? 'dragging' : ''}`}
          onDragEnter={(e) => handleDragEnter(e, 'attachment')}
          onDragLeave={(e) => handleDragLeave(e, 'attachment')}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'attachment')}
        >
          <div className="drop-zone-content-attachment">
            <h3>Attachment Files</h3>
            <p>Drag and drop files to be attached here</p>
            <p className="file-types">Supported formats: .txt, .docx, .png, .jpg, .jpeg, .pdf</p>
            <div className="file-input-container">
              <input
                type="file"
                id="attachment-file-input"
                multiple
                onChange={(e) => handleFileInput(e, 'attachment')}
                accept=".txt,.docx,.png,.jpg,.jpeg,.pdf"
                style={{ display: 'none' }}
              />
              <button 
                className="browse-button"
                onClick={() => {
                  document.getElementById('attachment-file-input').click();
                  setShowAttachmentDropdown(!showAttachmentDropdown);
                }}
              >
                Browse Attachment Files
              </button>
              {showAttachmentDropdown && (
                <div className="files-dropdown">
                  {Object.entries(attachmentFiles).length > 0 ? (
                    Object.entries(attachmentFiles).map(([key, obj], index) => (
                      <div key={`attachment-${key}`} className="file-item">
                        <span className="file-name" title={obj.file.name}>
                          {obj.file.name} ({obj.type})
                        </span>
                        <button 
                          className="remove-button"
                          onClick={() => handleRemoveFile(index, 'attachment')}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="no-files">No files selected</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Split Preview Section */}
      <div className="preview-section">
        <div className="preview-container">
          {/* Template Preview */}
          <div className="preview-content-section">
            <h3>Template Preview</h3>
            <div className="template-preview-content">
              {templateFiles.length > 0 ? (
                previewItems
                  .filter(item => item.file_type === 'message' || item.file_type === 'error')
                  .map((item) => (
                    <div
                      key={item.sequence_no}
                      className="template-preview-item"
                    >
                      <pre className="template-preview-pre">
                        {item.content}
                      </pre>
                    </div>
                  ))
              ) : (
                <div className="preview-placeholder">
                  <h4>Template Information</h4>
                  <p>Template files should contain placeholders that will be replaced with data from the Google Sheet.</p>
                  <div className="template-example">
                    <p>Example:</p>
                    <pre>Dear {'{name}'},</pre>
                    <pre>Your report is ready. Please find your details below:</pre>
                  </div>
                  <p className="preview-hint">Upload a template file to see its content</p>
                </div>
              )}
            </div>
          </div>

          {/* Content Sequencing */}
          <div className="sequencing-section">
            <h3>Content Sequencing</h3>
            <div className="sequencing-content">
              {previewItems.length > 0 ? (
                <div className="preview-items-container">
                  {previewItems.map((item, index) => (
                    <div 
                      key={item.sequence_no}
                      className={`preview-item ${draggedItem && draggedItem.sequence_no === item.sequence_no ? 'dragged' : ''}`}
                      draggable
                      onDragStart={(e) => handlePreviewDragStart(e, index)}
                      onDragOver={(e) => handlePreviewDragOver(e, index)}
                      onDrop={(e) => handlePreviewDrop(e, index)}
                    >
                      <div className="preview-item-number">
                        {item.sequence_no}.
                      </div>
                      <div className={`preview-item-content ${item.file_type === 'file' ? 'attachment' : 'template'}`}>
                        {item.file_type === 'message' ? 'Template Content' : item.file_name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sequencing-placeholder">
                  <p>Upload files to start sequencing</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-id-section">
        <div className="sheet-inputs">
          <div className="sheet-input-group">
            <label htmlFor="sheet-id">Google Sheet ID</label>
            <input
              type="text"
              id="sheet-id"
              value={sheetId}
              onChange={handleSheetIdChange}
              placeholder="Enter Google Sheet ID"
              className={sheetError ? 'error' : ''}
            />
            {sheetError && <span className="error-message">{sheetError}</span>}
          </div>
          
          <div className="sheet-input-group">
            <label htmlFor="sheet-name">Sheet Name</label>
            <input
              type="text"
              id="sheet-name"
              value={sheetName}
              onChange={handleSheetNameChange}
              placeholder="Enter Sheet Name"
            />
          </div>
        </div>

        <div className="service-account-section">
          <label>Service Account ID</label>
          <div className="service-account-container">
            <input
              type="text"
              value="ems-974@be-ss-automation-445106.iam.gserviceaccount.com"
              readOnly
              className="service-account-input"
            />
            <button 
              className={`copy-button ${copySuccess ? 'success' : ''}`}
              onClick={handleCopyServiceAccount}
            >
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p>Share the sheet with the service account email address</p>
        </div>
        <div className="sheet-headers-info">
              <h4>Required Google Sheet Headers:</h4>
              <div className="headers-container">
                <div className="header-item">
                  <span className="header-label">Name</span>
                </div>
                <div className="header-item">
                  <span className="header-label">Country Code</span>
                </div>
                <div className="header-item">
                  <span className="header-label">Contact No.</span>
                </div>
                <div className="header-item">
                  <span className="header-label">Email ID - To</span>
                </div>
                <button 
                  className="copy-all-headers-button"
                  onClick={() => {
                    const headers = ['Name', 'Country Code', 'Contact No.', 'Email ID'];
                    navigator.clipboard.writeText(headers.join('\t'));
                    alert('Headers copied to clipboard! Paste them in the first row of your Google Sheet');
                  }}
                >
                  Copy All Headers
                </button>
              </div>
              <p className="headers-note">Click "Copy All Headers" and paste them in the first row of your Google Sheet</p>
            </div>

        <p className="help-text">
          The sheet should contain recipient details (name, contact, email, etc.) that will be replaced in the template files.
        </p>
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
        disabled={previewItems.filter(item => item.file_type === 'message').length === 0 || !sheetId || !!sheetError || isLoading || (!sendWhatsapp && !sendEmail)}
      >
        {isLoading ? 'Generating Reports...' : 'Generate Reports'}
      </button>
    </div>
  );
};

export default Reports;
