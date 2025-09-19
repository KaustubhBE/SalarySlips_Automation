import React, { useState, useEffect } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ToggleButton from '../../Components/Toggle-Button';
import LoadingSpinner from '../../LoadingSpinner';
import '../../Processing.css';
import Navbar from '../../Navbar';
import Settings from '../../Components/Settings';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { getApiUrl, makeApiCall, ENDPOINTS } from '../../config.js';
import { useAuth } from '../../Components/AuthContext';
import axios from 'axios';
import AttachmentSequence from '../../Components/AttachmentSequence';

const plantData = [
  { 
    name: 'Head Office', 
    employee_drive_id: '1otjV4dGQQUKq-AKQDwgxClW1pPY7pZl99QscxixQUsA', 
    employee_salary_sheet_id_2024_25: '', 
    employee_salary_sheet_id_2025_26: ''
  },
  { 
    name: 'Gulbarga', 
    employee_drive_id: '1DmV91n5ryeAJ7t4xM4jMzv99X5f5wbtf_1LsCOOBj8Q', 
    employee_salary_sheet_id_2024_25: '1HUUF8g3GJ3ZaPyUsRhRgCURu5m0prtZRy7kEIZoc10M', 
    employee_salary_sheet_id_2025_26: ''
  },
  { 
    name: 'Kerur', 
    employee_drive_id: '1-rkSly48tCMVC0oH8OojmmQcg_0bspwuFNWD6KsqdBc', 
    employee_salary_sheet_id_2024_25: '', 
    employee_salary_sheet_id_2025_26: ''
  },
  { 
    name: 'Humnabad', 
    employee_drive_id: '1gAHUISFRUvxoskWia9WLoJw-UGzyH_TFO8yDZ9ifqMc', 
    employee_salary_sheet_id_2024_25: '15ouV8H0JGCHD1CTeVaQgOgIODMsI6dXolRyEJOju53U', 
    employee_salary_sheet_id_2025_26: ''
  },
  { 
    name: 'Omkar', 
    employee_drive_id: '1lnLmWcQ0RalUdCw19KK64JjpewVzMcMjLF9NoN-LRTo', 
    employee_salary_sheet_id_2024_25: '1qCmbnZpgtGrN6M0J3KFWi6p3-mKKT1xctjyZgmIN0J0', 
    employee_salary_sheet_id_2025_26: '1PfX_m8MXmfu94zlT6xjzIHFIfYjYhTPzyXjKnoXYslI'
  },
  {
    name: 'Padmavati',
    employee_drive_id: '', 
    employee_salary_sheet_id_2024_25: '', 
    employee_salary_sheet_id_2025_26: ''
  }
];

// Helper function to get previous month and year
const getPreviousMonth = () => {
  const today = new Date();
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const monthNames = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];
  
  // Convert to financial year month index (April = 0, March = 11)
  let fyMonthIndex = previousMonth.getMonth() - 3;
  if (fyMonthIndex < 0) fyMonthIndex += 12;
  
  // Calculate financial year
  const year = previousMonth.getFullYear();
  const fyYear = previousMonth.getMonth() < 3 ? year - 1 : year;
  
  return {
    month: monthNames[fyMonthIndex],
    financialYear: `${fyYear}-${(fyYear + 1).toString().slice(-2)}`
  };
};

// Helper function to check if a month/year combination is in the future or current
const isFutureOrCurrentMonth = (month, year) => {
  const today = new Date();
  const selectedDate = new Date(Date.parse(`${month} 1, ${year}`));
  
  // Set today to the first of the month for accurate month comparison
  const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return selectedDate >= firstOfCurrentMonth;
};

// Helper function to get available months based on financial year
const getAvailableMonths = (selectedFY) => {
  const monthNames = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];
  
  if (!selectedFY) return [];
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Parse selected financial year
  const [fyStartYear] = selectedFY.split('-').map(Number);
  const fyEndYear = fyStartYear + 1;
  
  // Get current financial year
  const currentFYStart = currentMonth < 3 ? currentYear - 1 : currentYear;
  
  if (fyStartYear < currentFYStart) {
    // Past financial year - show all months
    return monthNames;
  } else if (fyStartYear > currentFYStart) {
    // Future financial year - show no months
    return [];
  } else {
    // Current financial year - show months up to current month
    let availableMonths = [];
    if (currentMonth < 3) {
      // We're in Jan-Mar of the FY
      availableMonths = [
        ...monthNames.slice(0, 9), // Apr-Dec
        ...monthNames.slice(9, currentMonth + 9) // Jan up to current month
      ];
    } else {
      // We're in Apr-Dec of the FY
      availableMonths = monthNames.slice(0, currentMonth - 3);
    }
    return availableMonths;
  }
};

// Helper function to get available financial years
const getFinancialYears = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  // Start from FY 2022-23
  const startYear = 2024;
  
  // If we're in Jan-Mar, we're still in previous FY
  const currentFY = currentMonth < 3 ? currentYear - 1 : currentYear;
  
  const years = [];
  for (let year = startYear; year <= currentFY; year++) {
    years.push(`${year}-${(year + 1).toString().slice(-2)}`);
  }
  
  return years;
};

function Processing({ mode = 'single' }) {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false); // ENABLED WHATSAPP
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedPlantData, setSelectedPlantData] = useState({});
  const [loading, setLoading] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [employeeCode, setEmployeeCode] = useState('');
  const [plant, setPlant] = useState('');
  const prevMonth = getPreviousMonth();
  const [months, setMonths] = useState([{
    month: prevMonth.month,
    financialYear: prevMonth.financialYear
  }]);
  const [emailMessage, setEmailMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [attachmentSequence, setAttachmentSequence] = useState([]);

  // Get accessible plants based on user's factory permissions
  const getAccessiblePlants = () => {
    if (!user) return [];
    
    const userRole = user.role || 'user';
    const userPermissions = user.permissions || {};
    
    if (userRole === 'admin') {
      // Admin can access all plants
      return plantData;
    } else {
      // Regular users can access all plants (simplified for 2-layer RBAC)
      return plantData;
    }
  };
  
  const handleSelectChange = (event) => {
    const selectedPlantName = event.target.value;
    setSelectedPlant(selectedPlantName);
    const plant = plantData.find(p => p.name === selectedPlantName);
    setSelectedPlantData(plant || {});
  };

  const getFinancialYear = (date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const fyStart = month <= 2 ? year - 1 : year;
    const fyEnd = (fyStart + 1).toString().slice(-2);
    return `${fyStart}_${fyEnd}`;
  };

  const getSalarySheetId = (plant, date) => {
    const fy = getFinancialYear(date);
    const sheetIdKey = `employee_salary_sheet_id_${fy}`;
    const sheetId = plant[sheetIdKey];

    if (!sheetId) {
      throw new Error(`No salary sheet configured for ${plant.name} for financial year 20${fy.replace('_', '-')}`);
    }

    return sheetId;
  };

  const handleAddMonth = () => {
    setMonths([...months, { month: '', financialYear: '' }]);
  };

  const handleRemoveMonth = (index) => {
    const newMonths = months.filter((_, i) => i !== index);
    setMonths(newMonths);
  };

  const handleMonthChange = (index, field, value) => {
    const newMonths = [...months];
    newMonths[index] = {
      ...newMonths[index],
      [field]: value
    };
    setMonths(newMonths);
  };

  // Update attachment sequence when months change
  useEffect(() => {
    setAttachmentSequence(months.map(monthData => ({
      month: monthData.month,
      year: monthData.financialYear.split('-')[0]
    })));
  }, [months]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const monthsData = months.map(monthData => {
      const [fyStartYear] = monthData.financialYear.split('-').map(Number);
      const calendarYear = monthData.month === 'January' || monthData.month === 'February' || monthData.month === 'March' 
        ? fyStartYear + 1 
        : fyStartYear;

      return {
        month: monthData.month,
        year: calendarYear.toString(),
        sheet_id_salary: selectedPlantData[`employee_salary_sheet_id_${monthData.financialYear.replace('-', '_')}`],
        sheet_id_drive: selectedPlantData.employee_drive_id
      };
    });

    try {
      const endpoint = mode === 'single' ? ENDPOINTS.SINGLE_SLIP : ENDPOINTS.BATCH_SLIPS;
      const payload = {
        sheet_id_salary: monthsData[0].sheet_id_salary,
        sheet_id_drive: monthsData[0].sheet_id_drive,
        full_month: monthsData[0].month,
        full_year: monthsData[0].year,
        months_data: monthsData,
        send_whatsapp: sendWhatsapp,
        send_email: sendEmail,
        attachment_sequence: attachmentSequence
      };
      
      // Only add employee_code for single mode
      if (mode === 'single') {
        payload.employee_code = employeeDetails;
      }

      const response = await axios.post(getApiUrl(endpoint), payload);

      setResult(response.data);
    } catch (err) {
      const errorData = err.response?.data;
      let errorMessage = 'An error occurred while processing the request';
      
      if (errorData?.error) {
        switch (errorData.error) {
          case 'USER_NOT_LOGGED_IN':
            errorMessage = 'Your session has expired. Please log in again.';
            // Redirect to login or show login modal
            break;
          case 'TOKEN_EXPIRED':
            errorMessage = 'Your authentication token has expired. Please refresh your credentials.';
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
          case 'EMAIL_SEND_FAILED':
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
          case 'WHATSAPP_SEND_FAILED':
            errorMessage = 'Failed to send WhatsApp message. Please try again.';
            break;
          default:
            errorMessage = errorData.message || errorData.error || errorMessage;
        }
      }
      
      setError(errorMessage);
      
      // If user is not logged in, redirect to login
      if (errorData?.error === 'USER_NOT_LOGGED_IN') {
        // You can add logic here to redirect to login or show login modal
        console.log('User session expired, redirecting to login...');
      }
    } finally {
      setLoading(false);
    }
  };

  // Update financial year whenever date changes
  const handleDateChange = (date) => {
    setSelectedDate(date);
    const fy = getFinancialYear(date);
    setMonths([{
      month: getAvailableMonths(fy)[0],
      financialYear: fy
    }]);
  };

  // Check if user has permission to access this processing mode
  const hasProcessingPermission = () => {
    if (!user) return false;
    
    const userRole = user.role || 'user';
    
    if (userRole === 'admin') return true;
    
    // Check for specific processing permissions using the enhanced hasPermission function
    const requiredPermission = mode === 'single' ? 'single_processing' : 'batch_processing';
    return hasPermission(requiredPermission);
  };

  // If user doesn't have permission, show access denied message
  if (!hasProcessingPermission()) {
    return (
      <>
        <Navbar />
        <div className="input-elements">
          <div className="access-denied">
            <h2>Access Denied</h2>
            <p>You don't have permission to access {mode} salary processing.</p>
            <p>Please contact your administrator if you believe this is an error.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      {loading && <LoadingSpinner />}
      <Routes>
        <Route path="settings" element={<Settings />} />
        <Route path="" element={
          <div className="input-elements">
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
                onClick={() => navigate('/headoffice/humanresource')} 
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
            {mode === 'single' && (
              <>
                <label htmlFor="employeeDetails">Enter Employee Code:</label>
                <input
                  id="employeeDetails"
                  type="text"
                  placeholder='Employee Code'
                  value={employeeDetails}
                  onChange={(e) => setEmployeeDetails(e.target.value)}
                />
              </>
            )}

            <label htmlFor="plantDropdown">Select Plant:</label>
            <select id="plantDropdown" value={selectedPlant} onChange={handleSelectChange}>
              <option value="" disabled>Select Plant</option>
              {getAccessiblePlants().map((plant, index) => (
                <option key={index} value={plant.name}>{plant.name}</option>
              ))}
            </select>
            
            <div className="months-container">
              <label>Select Month & Financial Year:</label>
              <div className="month-group">
                <div className="form-group">
                  <label>Financial Year</label>
                  <select
                    value={months[0].financialYear}
                    onChange={(e) => handleMonthChange(0, 'financialYear', e.target.value)}
                    required
                  >
                    <option value="">Select Financial Year</option>
                    {getFinancialYears().map(fy => (
                      <option key={fy} value={fy}>
                        {fy}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Month</label>
                  <select
                    value={months[0].month}
                    onChange={(e) => handleMonthChange(0, 'month', e.target.value)}
                    required
                  >
                    <option value="">Select Month</option>
                    {getAvailableMonths(months[0].financialYear).map(month => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {mode === 'single' && (
                <>
                  {months.slice(1).map((monthData, index) => (
                    <div key={index + 1} className="month-group">
                      <div className="form-group">
                        <label>Financial Year</label>
                        <select
                          value={monthData.financialYear}
                          onChange={(e) => handleMonthChange(index + 1, 'financialYear', e.target.value)}
                          required
                        >
                          <option value="">Select Financial Year</option>
                          {getFinancialYears().map(fy => (
                            <option key={fy} value={fy}>
                              {fy}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Month</label>
                        <select
                          value={monthData.month}
                          onChange={(e) => handleMonthChange(index + 1, 'month', e.target.value)}
                          required
                        >
                          <option value="">Select Month</option>
                          {getAvailableMonths(monthData.financialYear).map(month => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="remove-month-btn"
                        onClick={() => handleRemoveMonth(index + 1)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-month-btn"
                    onClick={handleAddMonth}
                  >
                    Add Another Month
                  </button>
                </>
              )}
            </div>
            
            {months.length > 1 && (
              <AttachmentSequence
                months={months}
                sequence={attachmentSequence}
                onSequenceChange={setAttachmentSequence}
              />
            )}
            
            <div className="option-select">
              <div className='emailToggle' style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label htmlFor="emailToggle" style={{ margin: 0 }}>Email Message: </label>
                <ToggleButton
                  isToggled={sendEmail}
                  onToggle={() => setSendEmail((prev) => !prev)}
                />
              </div>
              <div className='whatsappToggle' style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label htmlFor="whatsappToggle" style={{ margin: 0 }}>WhatsApp Message: </label>
                <ToggleButton
                  isToggled={sendWhatsapp}
                  onToggle={() => setSendWhatsapp((prev) => !prev)}
                />
              </div>
            </div>
            
            <div className="button-group">
              <button 
                type="button" 
                className="btn" 
                onClick={handleSubmit}
                disabled={
                  !selectedPlant || 
                  months.some(m => !m.month || !m.financialYear) ||
                  (mode === 'single' && (!employeeDetails || employeeDetails.trim() === ''))
                }
              >
                Process Salary Slip{mode === 'single' ? 's' : ''}
              </button>
              
            </div>
          </div>
        } />
      </Routes>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="result-container">
          <h3>Processing Results</h3>
          <p>{result.message}</p>
          <div className="results-list">
            {result.results?.map((monthResult, index) => (
              <div
                key={index}
                className={`result-item ${monthResult.status}`}
              >
                <p>
                  {monthResult.month} {monthResult.year}: {monthResult.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default Processing;