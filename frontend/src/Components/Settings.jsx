import React from 'react';

function Settings({ user, onLogout }) {
  return (
    <div className="settings-container">
      <style>
        {`
          .settings-container {
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 5px;
            background-color: #f9f9f9;
            box-sizing: border-box;
          }

          .settings-container h2 {
            text-align: center;
            margin-bottom: 20px;
          }

          .user-info {
            margin-bottom: 20px;
          }

          .user-info p {
            font-size: 16px;
            color: #333;
          }

          .logout-button {
            width: 100%;
            padding: 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s ease;
          }

          .logout-button:hover {
            background-color: #45a049;
          }
        `}
      </style>
      <h2>Settings</h2>
      <div className="user-info">
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
      </div>
      <button className="logout-button" onClick={onLogout}>Logout</button>
    </div>
  );
}

export default Settings;