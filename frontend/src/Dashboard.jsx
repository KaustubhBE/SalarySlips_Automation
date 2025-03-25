import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css'; // Import the CSS file

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/get_users', {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        setError('');
      } else {
        setError('Unexpected response format');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching users');
      setUsers([]);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/add_user', 
        { username, email, password, role },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.message) {
        setSuccess(response.data.message);
        setError('');
        fetchUsers();
        // Clear form
        setUsername('');
        setEmail('');
        setPassword('');
        setRole('user');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error adding user');
      setSuccess('');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await axios.post('http://localhost:5000/api/delete_user', 
        { user_id: userId },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error deleting user');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const response = await axios.post('http://localhost:3000/api/update_role', 
        { user_id: userId, role: newRole },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating user role');
    }
  };

  return (
    <div className="dashboard-container">
      <h1>User Management</h1>
      
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      
      <div className="users-list">
        <h2>Current Users</h2>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <select
                    className="role-select"
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <button 
                    className="action-button delete-button"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="add-user-form">
        <h2>Add New User</h2>
        <form onSubmit={handleAddUser}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="role">Role:</label>
            <select 
              id="role" 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          <button type="submit">Add User</button>
        </form>
      </div>
    </div>
  );
}

export default Dashboard;