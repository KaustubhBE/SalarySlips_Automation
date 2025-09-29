import React, { useState, useCallback, useEffect } from 'react';
import '../../Reports.css';
import { getApiUrl } from '../../config';
import { useAuth } from '../../Components/AuthContext';
import LoadingSpinner from '../../LoadingSpinner';

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
  const [previewItems, setPreviewItems] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [showTokenExpiredModal, setShowTokenExpiredModal] = useState(false);
  const [storedRequestData, setStoredRequestData] = useState(null);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [useTemplateAsCaption, setUseTemplateAsCaption] = useState(false);

  const { user } = useAuth();

  // Google Login logic
  const GOOGLE_CLIENT_ID = '579518246340-0673etiich0q7ji2q6imu7ln525554ab.apps.googleusercontent.com';

  // Only initialize Google button when modal is shown
  useEffect(() => {
    if (showTokenExpiredModal) {
      if (!window.google) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            scope: 'https://www.googleapis.com/auth/gmail.send',
            ux_mode: 'popup',
          });
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-btn-reports'),
            { theme: 'outline', size: 'large' }
          );
        };
        document.body.appendChild(script);
      } else {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          scope: 'https://www.googleapis.com/auth/gmail.send',
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn-reports'),
          { theme: 'outline', size: 'large' }
        );
      }
    }
    // eslint-disable-next-line
  }, [showTokenExpiredModal]);

  function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const userData = JSON.parse(window.atob(base64));
    
    // Update token in Firebase and retry reports
    handleTokenRefresh(userData.email, response.credential);
  }

  const handleTokenRefresh = async (userEmail, googleToken) => {
    setIsRefreshingToken(true);
    try {
      const response = await fetch(getApiUrl('refresh-token'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          user_email: userEmail,
          google_token: googleToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh token');
      }

      const result = await response.json();
      console.log('Token refreshed successfully:', result);

      // Now retry the reports
      if (storedRequestData) {
        await retryReports(storedRequestData);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      alert('Failed to refresh token: ' + error.message);
    } finally {
      setIsRefreshingToken(false);
      setShowTokenExpiredModal(false);
      setStoredRequestData(null);
    }
  };

  const retryReports = async (requestData) => {
    try {
      const response = await fetch(getApiUrl('retry-reports'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          original_request_data: requestData
        })
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Failed to retry reports' };
        }
        
        if (response.status === 401 && errorData.error === 'TOKEN_EXPIRED') {
          // Token expired again, show modal again
          setStoredRequestData(requestData);
          setShowTokenExpiredModal(true);
          return;
        }
        
        // Handle other specific error types
        let errorMessage = 'Failed to retry reports';
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
            default:
              errorMessage = errorData.message || errorData.error || errorMessage;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Show detailed log report
      showDetailedLogReport(result);
      
      // Reset form
      setTemplateFiles([]);
      setAttachmentFiles([]);
      setSheetId('');
      setSheetName('');
      setSendEmail(false);
      setMailSubject('');
      setPreviewItems([]);
      setUseTemplateAsCaption(false);
      
      // Refresh the page after successful submission
      window.location.reload();
      
    } catch (error) {
      console.error('Error retrying reports:', error);
      alert(error.message || 'Failed to retry reports. Please try again.');
    }
  };

  const handleGoogleAuth = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.prompt();
    } else {
      alert('Google authentication is not available. Please refresh the page and try again.');
    }
  };

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
      // Check caption mode limits
      if (useTemplateAsCaption && validFiles.length > 1) {
        alert('Caption mode is enabled. Only one template file can be uploaded.');
        return;
      }
      if (!useTemplateAsCaption && validFiles.length > 1) {
        alert('Only one template file can be uploaded');
        return;
      }
      setTemplateFiles(validFiles);
      await buildAndSetPreviewItems(validFiles, attachmentFiles); // Update preview immediately
    } else {
      setAttachmentFiles(prevFiles => {
        const newFiles = { ...prevFiles };
        let maxKey = Object.keys(newFiles).length > 0 ? Math.max(...Object.keys(newFiles).map(Number)) : 0;
        
        // Check caption mode limits for attachments
        if (useTemplateAsCaption) {
          const currentCount = Object.keys(newFiles).length;
          const newFilesCount = validFiles.length;
          if (currentCount + newFilesCount > 1) {
            alert('Caption mode is enabled. Only one attachment file can be uploaded.');
            return prevFiles;
          }
        }
        
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
      // Check caption mode limits
      if (useTemplateAsCaption && validFiles.length > 1) {
        alert('Caption mode is enabled. Only one template file can be uploaded.');
        return;
      }
      if (!useTemplateAsCaption && validFiles.length > 1) {
        alert('Only one template file can be uploaded');
        return;
      }
      setTemplateFiles(validFiles);
      buildAndSetPreviewItems(validFiles, attachmentFiles); // Update preview immediately
    } else {
      setAttachmentFiles(prevFiles => {
        const newFiles = { ...prevFiles };
        let maxKey = Object.keys(newFiles).length > 0 ? Math.max(...Object.keys(newFiles).map(Number)) : 0;
        
        // Check caption mode limits for attachments
        if (useTemplateAsCaption) {
          const currentCount = Object.keys(newFiles).length;
          const newFilesCount = validFiles.length;
          if (currentCount + newFilesCount > 1) {
            alert('Caption mode is enabled. Only one attachment file can be uploaded.');
            return prevFiles;
          }
        }
        
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
    navigator.clipboard.writeText('ems-974@be-ss-automation-445106.iam.gserviceaccount.com');
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

  const handleRemovePreviewItem = (sequenceNo) => {
    const itemToRemove = previewItems.find(item => item.sequence_no === sequenceNo);
    if (!itemToRemove) return;

    // Remove from the appropriate state based on file type
    if (itemToRemove.file_type === 'message') {
      // Remove template file
      setTemplateFiles([]);
      // Update preview items without template
      const updatedItems = previewItems.filter(item => item.sequence_no !== sequenceNo);
      // Re-sequence remaining items
      const resequencedItems = updatedItems.map((item, index) => ({
        ...item,
        sequence_no: index + 1
      }));
      setPreviewItems(resequencedItems);
    } else {
      // Remove attachment file
      const attachmentFileToRemove = Object.values(attachmentFiles).find(
        obj => obj.file.name === itemToRemove.file_name
      );
      
      if (attachmentFileToRemove) {
        // Find the key for this attachment file
        let keyToRemove = null;
        for (const key in attachmentFiles) {
          if (attachmentFiles[key].file.name === itemToRemove.file_name) {
            keyToRemove = key;
            break;
          }
        }
        
        if (keyToRemove) {
          const newAttachmentFiles = { ...attachmentFiles };
          delete newAttachmentFiles[keyToRemove];
          
          // Re-sequence the remaining attachment files
          const filesArr = Object.values(newAttachmentFiles);
          const resequenced = {};
          filesArr.forEach((obj, i) => {
            resequenced[i + 1] = obj;
          });
          
          setAttachmentFiles(resequenced);
          
          // Update preview items
          const updatedItems = previewItems.filter(item => item.sequence_no !== sequenceNo);
          const resequencedItems = updatedItems.map((item, index) => ({
            ...item,
            sequence_no: index + 1
          }));
          setPreviewItems(resequencedItems);
        }
      }
    }
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
    // if (!sendEmail) {
    //   alert('Please select at least one notification method (Email)');
    //   return;
    // }

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
      formData.append('use_template_as_caption', useTemplateAsCaption);

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
        credentials: 'include',
        headers: {
          // Don't set Content-Type header when sending FormData
          // The browser will automatically set it with the correct boundary
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Failed to generate reports' };
        }
        // Handle token expired error
        if (response.status === 401 && errorData.error === 'TOKEN_EXPIRED') {
          // Store the request data that was sent back from the server
          if (errorData.request_data) {
            setStoredRequestData(errorData.request_data);
          } else {
            // Fallback: store basic form data
            setStoredRequestData({
              template_files_data: [],
              attachment_files_data: [],
              file_sequence: sortedItems.map(item => ({
                file_name: item.file_name,
                file_type: item.file_type,
                sequence_no: item.sequence_no
              })),
              sheet_id: sheetId,
              sheet_name: sheetName,
              send_whatsapp: sendWhatsapp,
              send_email: sendEmail,
              mail_subject: mailSubject
            });
          }
          setShowTokenExpiredModal(true);
          setIsLoading(false);
          return;
        }
        
        // Handle other specific error types
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
            default:
              errorMessage = errorData.message || errorData.error || errorMessage;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Show detailed log report
      showDetailedLogReport(result);
      
      // Reset form
      setTemplateFiles([]);
      setAttachmentFiles([]);
      setSheetId('');
      setSheetName('');
      setSendWhatsapp(false);
      setSendEmail(false);
      setMailSubject('');
      setPreviewItems([]);
      setUseTemplateAsCaption(false);
      
      // Refresh the page after successful submission
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
      
      {/* Token Expired Modal */}
      {showTokenExpiredModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Session Expired</h2>
            <p>Your Google authentication has expired. Please re-authenticate to continue sending reports.</p>
            {isRefreshingToken ? (
              <div className="loading-state">
                <p>Refreshing token and retrying reports...</p>
                <LoadingSpinner />
              </div>
            ) : (
              <div id="google-signin-btn-reports"></div>
            )}
          </div>
        </div>
      )}


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

      {/* Caption Option - Permanent checkbox */}
      <div className="caption-section">
        <div className="caption-option">
          <label className="caption-checkbox-label">
            <input
              type="checkbox"
              checked={useTemplateAsCaption}
              onChange={(e) => {
                setUseTemplateAsCaption(e.target.checked);
                // Clear files when switching modes to avoid conflicts
                if (e.target.checked) {
                  // When enabling caption mode, limit to 1 template and 1 attachment
                  if (templateFiles.length > 1) {
                    setTemplateFiles([templateFiles[0]]);
                  }
                  if (Object.keys(attachmentFiles).length > 1) {
                    const firstAttachment = Object.values(attachmentFiles)[0];
                    setAttachmentFiles({ 1: firstAttachment });
                  }
                }
              }}
              className="caption-checkbox"
            />
            <span className="caption-checkbox-text">
              Use template text as attachment caption (Single file mode)
            </span>
          </label>
          <p className="caption-help-text">
            When enabled: Upload exactly 1 template file and 1 attachment file. 
            When disabled: Upload multiple files as needed.
          </p>
        </div>
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
            <p className="file-types">
              Supported formats: .docx
              {useTemplateAsCaption && <span className="mode-indicator"> (Single file mode)</span>}
            </p>
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
                }}
              >
                Browse Template Files
              </button>
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
            <p className="file-types">
              Supported formats: .txt, .docx, .png, .jpg, .jpeg, .pdf
              {useTemplateAsCaption && <span className="mode-indicator"> (Single file mode)</span>}
            </p>
            <div className="file-input-container">
              <input
                type="file"
                id="attachment-file-input"
                multiple={!useTemplateAsCaption}
                onChange={(e) => handleFileInput(e, 'attachment')}
                accept=".txt,.docx,.png,.jpg,.jpeg,.pdf"
                style={{ display: 'none' }}
              />
              <button 
                className="browse-button"
                onClick={() => {
                  document.getElementById('attachment-file-input').click();
                }}
              >
                Browse Attachment Files
              </button>
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
                      <button 
                        className="preview-item-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePreviewItem(item.sequence_no);
                        }}
                        title="Remove this item"
                      >
                        ×
                      </button>
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

