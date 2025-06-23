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

const PrivacyPolicy = () => {
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Privacy Policy</h1>
      <div style={contentStyle}>
        <section style={sectionStyle}>
          <h2 style={headingStyle}>1. Information We Collect</h2>
          <p style={paragraphStyle}>We collect information that you provide directly to us, including but not limited to:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Name and contact information</li>
            <li style={listItemStyle}>Employee identification details</li>
            <li style={listItemStyle}>Usage data and preferences</li>
            <li style={listItemStyle}>System access logs</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>2. How We Use Your Information</h2>
          <p style={paragraphStyle}>We use the collected information for:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Providing and maintaining our services</li>
            <li style={listItemStyle}>Processing your requests and transactions</li>
            <li style={listItemStyle}>Improving our services</li>
            <li style={listItemStyle}>Ensuring system security</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>3. Data Security</h2>
          <p style={paragraphStyle}>We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>4. Data Retention</h2>
          <p style={paragraphStyle}>We retain your information for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required by law.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>5. Your Rights</h2>
          <p style={paragraphStyle}>You have the right to:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>Access your personal information</li>
            <li style={listItemStyle}>Correct inaccurate data</li>
            <li style={listItemStyle}>Request deletion of your data</li>
            <li style={listItemStyle}>Object to data processing</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>6. Contact Us</h2>
          <p style={paragraphStyle}>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p style={paragraphStyle}>Email: info@bajajearths.com</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 