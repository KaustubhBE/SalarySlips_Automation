import React, { useState } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ToggleButton from './Components/Toggle-Button';
import LoadingSpinner from './LoadingSpinner';
import './Processing.css';
import Navbar from './Navbar';
import Settings from './Components/Settings';
import { Route, Routes } from 'react-router-dom';
import { getApiUrl, makeApiCall, ENDPOINTS } from './config';

const plantData = [
  { name: 'Head Office', employee_drive_id: '1otjV4dGQQUKq-AKQDwgxClW1pPY7pZl99QscxixQUsA', employee_salary_sheet_id: '' },
  { name: 'Gulbarga', employee_drive_id: '1DmV91n5ryeAJ7t4xM4jMzv99X5f5wbtf_1LsCOOBj8Q', employee_salary_sheet_id: '1HUUF8g3GJ3ZaPyUsRhRgCURu5m0prtZRy7kEIZoc10M' },
  { name: 'Kerur', employee_drive_id: '1-rkSly48tCMVC0oH8OojmmQcg_0bspwuFNWD6KsqdBc', employee_salary_sheet_id: '' },
  { name: 'Humnabad', employee_drive_id: '1gAHUISFRUvxoskWia9WLoJw-UGzyH_TFO8yDZ9ifqMc', employee_salary_sheet_id: '15ouV8H0JGCHD1CTeVaQgOgIODMsI6dXolRyEJOju53U' },
  { name: 'Omkar', employee_drive_id: '1lnLmWcQ0RalUdCw19KK64JjpewVzMcMjLF9NoN-LRTo', employee_salary_sheet_id: '1qCmbnZpgtGrN6M0J3KFWi6p3-mKKT1xctjyZgmIN0J0' },
];

function Processing({ mode = 'single' }) {
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPlant, setSelectedPlant] = useState('');
  const [plant, setPlant] = useState({});
  const [loading, setLoading] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const handleSelectChange = (event) => {
    const selectedPlantName = event.target.value;
    setSelectedPlant(selectedPlantName);
    const selectedPlantData = plantData.find(plant => plant.name === selectedPlantName);
    setPlant(selectedPlantData || {});
  };

  const handleSubmit = async () => {
    const fullMonth = selectedDate.toLocaleString('default', { month: 'long' });
    const fullYear = selectedDate.getFullYear();
    const sheetName = `${fullMonth.slice(0, 3)}${fullYear.toString().slice(-2)}`;
    
    const payload = {
      sheet_id_salary: plant.employee_salary_sheet_id,
      sheet_id_drive: plant.employee_drive_id,
      full_month: fullMonth,
      full_year: fullYear,
      sheet_name: sheetName,
      send_whatsapp: sendWhatsApp,
      send_email: sendEmail,
      ...(mode === 'single' && { employee_identifier: employeeDetails })
    };

    setLoading(true);
    try {
      const endpoint = mode === 'single' ? ENDPOINTS.SINGLE_SLIP : ENDPOINTS.BATCH_SLIPS;
      const response = await makeApiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      alert(response.message || 'Operation completed successfully');
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      {loading && <LoadingSpinner />}
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={
          <div className="input-elements">
            {mode === 'single' && (
              <>
                <label htmlFor="employeeDetails">Enter Employee Name or Code:</label>
                <input
                  id="employeeDetails"
                  type="text"
                  placeholder='Name or Employee Code'
                  value={employeeDetails}
                  onChange={(e) => setEmployeeDetails(e.target.value)}
                />
              </>
            )}

            <label htmlFor="plantDropdown">Select Plant:</label>
            <select id="plantDropdown" value={selectedPlant} onChange={handleSelectChange}>
              <option value="" disabled>Select Plant</option>
              {plantData.map((plant, index) => (
                <option key={index} value={plant.name}>{plant.name}</option>
              ))}
            </select>
            
            <label htmlFor="datePicker">Select Month & Year:</label>
            <ReactDatePicker
              id="datePicker"
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              maxDate={new Date()}
              minDate={new Date('2016-01-01')}
            />
            
            <div className="option-select">
              <div className='whatsappToggle' style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label htmlFor="whatsappToggle" style={{ margin: 0 }}>WhatsApp Message: </label>
                <ToggleButton
                  isToggled={sendWhatsApp}
                  onToggle={() => setSendWhatsApp((prev) => !prev)}
                />
              </div>
              <div className='emailToggle' style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label htmlFor="emailToggle" style={{ margin: 0 }}>Email Message: </label>
                <ToggleButton
                  isToggled={sendEmail}
                  onToggle={() => setSendEmail((prev) => !prev)}
                />
              </div>
            </div>
            
            <button type="button" className="btn" onClick={handleSubmit}>Process Salary Slip</button>
          </div>
        } />
      </Routes>
    </>
  );
}

export default Processing;