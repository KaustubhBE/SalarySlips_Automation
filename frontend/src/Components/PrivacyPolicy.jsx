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

const PrivacyPolicy = () => {
  return (
    <>
      <Navbar />
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
              <li style={listItemStyle}>Payroll and salary information</li>
              <li style={listItemStyle}>Department and factory assignments</li>
              <li style={listItemStyle}>User permissions and access levels</li>
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
              <li style={listItemStyle}>Automated salary slip generation and distribution</li>
              <li style={listItemStyle}>Factory and department management operations</li>
              <li style={listItemStyle}>User authentication and access control</li>
              <li style={listItemStyle}>Generating reports and analytics</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>3. Google API Integration and Data Usage</h2>
            <p style={paragraphStyle}>Our system integrates with Google APIs to provide enhanced functionality. When you use our services, we may access and use the following Google services:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}><strong>Google Sheets API:</strong> We access Google Sheets to read payroll data, employee information, and other operational data necessary for salary slip generation and business operations.</li>
              <li style={listItemStyle}><strong>Gmail API:</strong> We use Gmail to send automated salary slips, notifications, and other business communications to employees and authorized personnel.</li>
              <li style={listItemStyle}><strong>Google Drive API:</strong> We store and retrieve documents, salary slips, reports, and other business files in Google Drive for secure document management and archival.</li>
            </ul>
            <p style={paragraphStyle}>We only access data that is necessary for providing our services. We do not sell, rent, or share your data with third parties except as required for the operation of our services or as required by law.</p>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>4. Data Security</h2>
            <p style={paragraphStyle}>We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. This includes:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Encrypted data transmission using industry-standard protocols</li>
              <li style={listItemStyle}>Secure authentication and authorization mechanisms</li>
              <li style={listItemStyle}>Regular security audits and updates</li>
              <li style={listItemStyle}>Role-based access control to ensure data is only accessible to authorized personnel</li>
              <li style={listItemStyle}>Compliance with Google API security requirements</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>5. Data Retention</h2>
            <p style={paragraphStyle}>We retain your information for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required by law. This includes:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Employee data: Retained for the duration of employment and as required by law</li>
              <li style={listItemStyle}>Payroll records: Retained for statutory compliance periods</li>
              <li style={listItemStyle}>System access logs: Retained for security and audit purposes</li>
              <li style={listItemStyle}>Google API data: Managed according to Google's data retention policies</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>6. Your Rights</h2>
            <p style={paragraphStyle}>You have the right to:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Access your personal information</li>
              <li style={listItemStyle}>Correct inaccurate data</li>
              <li style={listItemStyle}>Request deletion of your data</li>
              <li style={listItemStyle}>Object to data processing</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>7. Google API User Data Policy</h2>
            <p style={paragraphStyle}>Our use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. We will not:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Use Google API data for advertising purposes</li>
              <li style={listItemStyle}>Sell Google API data to third parties</li>
              <li style={listItemStyle}>Use Google API data for purposes other than providing our core functionality</li>
              <li style={listItemStyle}>Transfer Google API data to other applications without explicit user consent</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>8. Contact Us</h2>
            <p style={paragraphStyle}>If you have any questions about this Privacy Policy or our use of Google APIs, please contact us at:</p>
            <p style={paragraphStyle}><strong>Email:</strong> info@bajajearths.com</p>
            <p style={paragraphStyle}><strong>Phone:</strong> +91-22-2497 4755</p>
            <p style={paragraphStyle}><strong>Address:</strong> 503, Lodha Supremus, Senapati Bapat Marg, Opposite World Towers, Railway Colony, Lower Parel (W), Mumbai, Maharashtra - 400013</p>
          </section>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy; 