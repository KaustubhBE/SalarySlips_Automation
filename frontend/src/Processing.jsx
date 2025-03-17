import React, { useState } from 'react';
import './Processing.css';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ToggleButton from './Components/Toggle-Button';
import LoadingSpinner from './LoadingSpinner';
import Navbar from './Navbar';
import { getApiUrl } from './config';

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

  const handleSelectChange = (e) => {
    const selectedPlantName = e.target.value;
    setSelectedPlant(selectedPlantName);
    const selectedPlantData = plantData.find(p => p.name === selectedPlantName);
    setPlant(selectedPlantData || {});
  };

  const handleSubmit = async () => {
    if (!selectedPlant) {
      alert('Please select a plant');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'single' ? 'process_single' : 'process_batch';
      const apiUrl = getApiUrl(endpoint);
      
      const requestData = {
        plant_name: selectedPlant,
        month: selectedDate.getMonth() + 1,
        year: selectedDate.getFullYear(),
        send_whatsapp: sendWhatsApp,
        send_email: sendEmail,
        ...(mode === 'single' && { employee_details: employeeDetails })
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to process request');
      }

      alert('Processing completed successfully');
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while processing the request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      {loading && <LoadingSpinner />}
      <div className="main-content">
        <div className="input-elements">
          {mode === 'single' && (
            <>
              <label htmlFor="employeeDetails">Enter Employee name or code:</label>
              <input
                id="employeeDetails"
                type="text"
                placeholder='Name or Employee Code'
                value={employeeDetails}
                onChange={(e) => setEmployeeDetails(e.target.value)}
              />
            </>
          )}
          
          <label htmlFor="plantDropdown">Select Plant: </label>
          <select id="plantDropdown" value={selectedPlant} onChange={handleSelectChange}>
            <option value="" disabled>Select Plant</option>
            {plantData.map((plant, index) => (
              <option key={index} value={plant.name}>{plant.name}</option>
            ))}
          </select>

          <label htmlFor="monthYearPicker">Select Month & Year: </label>
          <ReactDatePicker
            id="monthYearPicker"
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            maxDate={new Date()}
            minDate={new Date('2016-01-01')}
          />
        </div>

        <div className="option-select">
          <div className='whatsappToggle' style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label htmlFor="whatsappToggleInput" style={{ margin: 0 }}>WhatsApp Message: </label>
            <ToggleButton
              id="whatsappToggleInput"
              isToggled={sendWhatsApp}
              onToggle={() => setSendWhatsApp((prev) => !prev)}
            />
          </div>
          <div className='emailToggle' style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label htmlFor="emailToggleInput" style={{ margin: 0 }}>Email Message: </label>
            <ToggleButton
              id="emailToggleInput"
              isToggled={sendEmail}
              onToggle={() => setSendEmail((prev) => !prev)}
            />
          </div>
        </div>
        <div className="button">
          <button type="button" className="btn" onClick={handleSubmit}>
            Process Salary Slip
          </button>
        </div>
      </div>
    </>
  );
}

export default Processing; 