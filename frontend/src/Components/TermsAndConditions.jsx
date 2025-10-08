import React from 'react';
import Navbar from '../Navbar';

const containerStyle = {
  maxWidth: '1200px',
  margin: '2rem auto',
  padding: '2rem',
  backgroundColor: '#ffffff',
  boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
  borderRadius: '8px'
};

const titleStyle = {
  color: '#333',
  textAlign: 'center',
  marginBottom: '2rem',
  fontSize: '2.5rem'
};

const contentStyle = {
  lineHeight: 1.6
};

const sectionStyle = {
  marginBottom: '2rem'
};

const headingStyle = {
  color: '#444',
  marginBottom: '1rem',
  fontSize: '1.5rem'
};

const paragraphStyle = {
  color: '#666',
  marginBottom: '1rem'
};

const listStyle = {
  listStyleType: 'disc',
  marginLeft: '2rem',
  marginBottom: '1rem'
};

const listItemStyle = {
  color: '#666',
  marginBottom: '0.5rem'
};

const TermsAndConditions = () => {
  return (
    <>
      <Navbar />
      <div style={containerStyle}>
        <h1 style={titleStyle}>Terms and Conditions</h1>
        <div style={contentStyle}>
          <section style={sectionStyle}>
            <h2 style={headingStyle}>1. Acceptance of Terms</h2>
            <p style={paragraphStyle}>By accessing and using the Bajaj Earths Admin Portal system, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the system. This system is designed for authorized personnel of Bajaj Earths Private Limited and its associated facilities.</p>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>2. User Responsibilities</h2>
            <p style={paragraphStyle}>As a user of the system, you agree to:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Provide accurate and complete information</li>
              <li style={listItemStyle}>Maintain the confidentiality of your account credentials</li>
              <li style={listItemStyle}>Use the system in compliance with all applicable laws and company policies</li>
              <li style={listItemStyle}>Report any security breaches or unauthorized access immediately</li>
              <li style={listItemStyle}>Use the system only for authorized business purposes</li>
              <li style={listItemStyle}>Ensure data accuracy when entering payroll and employee information</li>
              <li style={listItemStyle}>Follow department-specific guidelines and procedures</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>3. System Usage</h2>
            <p style={paragraphStyle}>The system is provided for authorized business purposes only. Users must not:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Share access credentials with unauthorized persons</li>
              <li style={listItemStyle}>Attempt to bypass security measures or access controls</li>
              <li style={listItemStyle}>Use the system for any illegal activities or personal gain</li>
              <li style={listItemStyle}>Interfere with system operations or other users' access</li>
              <li style={listItemStyle}>Access data or functions outside their authorized scope</li>
              <li style={listItemStyle}>Modify system settings or configurations without authorization</li>
              <li style={listItemStyle}>Use the system for purposes other than business operations</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>4. Google API Integration and Data Management</h2>
            <p style={paragraphStyle}>The system integrates with Google APIs for enhanced functionality. Users are responsible for:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Understanding that the system accesses Google Sheets, Gmail, and Google Drive as necessary for operations</li>
              <li style={listItemStyle}>Ensuring data accuracy and completeness when working with integrated services</li>
              <li style={listItemStyle}>Following Google API usage policies and guidelines</li>
              <li style={listItemStyle}>Maintaining appropriate backups of critical data</li>
              <li style={listItemStyle}>Following data retention policies for both local and cloud-stored data</li>
              <li style={listItemStyle}>Protecting sensitive information and maintaining confidentiality</li>
              <li style={listItemStyle}>Complying with data privacy regulations when handling employee and payroll information</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>5. Factory and Department Access</h2>
            <p style={paragraphStyle}>Access to specific factories and departments is granted based on user roles and authorization levels:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Users are granted access only to their assigned factory and department</li>
              <li style={listItemStyle}>Admin users have broader access across multiple facilities</li>
              <li style={listItemStyle}>Department-specific permissions control access to various system modules</li>
              <li style={listItemStyle}>Unauthorized access attempts will be logged and may result in account suspension</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>6. System Availability</h2>
            <p style={paragraphStyle}>While we strive to maintain system availability, we do not guarantee uninterrupted access. We reserve the right to perform maintenance and updates as needed. This includes:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Scheduled maintenance windows will be communicated in advance</li>
              <li style={listItemStyle}>Emergency maintenance may be performed with minimal notice</li>
              <li style={listItemStyle}>System updates may temporarily affect certain features</li>
              <li style={listItemStyle}>Google API service availability depends on Google's service status</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>7. Compliance and Legal Requirements</h2>
            <p style={paragraphStyle}>Users must comply with all applicable laws and regulations, including:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Labor laws and employment regulations</li>
              <li style={listItemStyle}>Data protection and privacy laws</li>
              <li style={listItemStyle}>Financial and tax compliance requirements</li>
              <li style={listItemStyle}>Industry-specific regulations and standards</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>8. Modifications</h2>
            <p style={paragraphStyle}>We reserve the right to modify these terms at any time. Users will be notified of significant changes. Continued use of the system after changes constitutes acceptance of the modified terms.</p>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>9. Contact</h2>
            <p style={paragraphStyle}>For questions regarding these Terms and Conditions, please contact:</p>
            <p style={paragraphStyle}><strong>Email:</strong> info@bajajearths.com</p>
            <p style={paragraphStyle}><strong>Phone:</strong> +91-22-2497 4755</p>
            <p style={paragraphStyle}><strong>Address:</strong> 503, Lodha Supremus, Senapati Bapat Marg, Opposite World Towers, Railway Colony, Lower Parel (W), Mumbai, Maharashtra - 400013</p>
          </section>
        </div>
      </div>
    </>
  );
};

export default TermsAndConditions; 