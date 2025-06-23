import React from 'react';

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
    <div style={containerStyle}>
      <h1 style={titleStyle}>Terms and Conditions</h1>
      <div style={contentStyle}>
        <section style={sectionStyle}>
          <h2 style={headingStyle}>1. Acceptance of Terms</h2>
          <p style={paragraphStyle}>By accessing and using the Bajaj Earths system, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the system.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>2. User Responsibilities</h2>
          <p style={paragraphStyle}>As a user of the system, you agree to:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Provide accurate and complete information</li>
            <li style={listItemStyle}>Maintain the confidentiality of your account</li>
            <li style={listItemStyle}>Use the system in compliance with all applicable laws</li>
            <li style={listItemStyle}>Report any security breaches or unauthorized access</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>3. System Usage</h2>
          <p style={paragraphStyle}>The system is provided for authorized business purposes only. Users must not:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Share access credentials with unauthorized persons</li>
            <li style={listItemStyle}>Attempt to bypass security measures</li>
            <li style={listItemStyle}>Use the system for any illegal activities</li>
            <li style={listItemStyle}>Interfere with system operations</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>4. Data Management</h2>
          <p style={paragraphStyle}>Users are responsible for:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Ensuring data accuracy and completeness</li>
            <li style={listItemStyle}>Maintaining appropriate backups</li>
            <li style={listItemStyle}>Following data retention policies</li>
            <li style={listItemStyle}>Protecting sensitive information</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>5. System Availability</h2>
          <p style={paragraphStyle}>While we strive to maintain system availability, we do not guarantee uninterrupted access. We reserve the right to perform maintenance and updates as needed.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>6. Modifications</h2>
          <p style={paragraphStyle}>We reserve the right to modify these terms at any time. Users will be notified of significant changes. Continued use of the system after changes constitutes acceptance of the modified terms.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>7. Contact</h2>
          <p style={paragraphStyle}>For questions regarding these Terms and Conditions, please contact:</p>
          <p style={paragraphStyle}>Email: info@bajajearths.com</p>
        </section>
      </div>
    </div>
  );
};

export default TermsAndConditions; 