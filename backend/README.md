# Salary Slip Automation API

This project is a Salary Slip Automation API built using Flask for the backend and React for the frontend. The API allows users to generate salary slips for employees, manage user roles, and fetch logs. The frontend provides an admin panel for managing users and generating salary slips.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Frontend Components](#frontend-components)
- [Contributing](#contributing)
- [License](#license)

## Features

- Generate salary slips for individual employees or in batch
- Manage user roles (admin and user)
- Fetch logs
- Admin panel for managing users and generating salary slips

## Installation

### Backend

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/salary-slip-automation.git
    cd salary-slip-automation/backend
    ```

2. Create a virtual environment and activate it:
    ```sh
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3. Install the required dependencies:
    ```sh
    pip install -r requirements.txt
    ```

4. Set up the database:
    ```sh
    python -c "from Utils.setup_db import initialize_database; initialize_database()"
    ```

5. Run the Flask server:
    ```sh
    python app.py
    ```

### Frontend

1. Navigate to the frontend directory:
    ```sh
    cd ../frontend
    ```

2. Install the required dependencies:
    ```sh
    npm install
    ```

3. Start the React development server:
    ```sh
    npm start
    ```

## Usage

1. Open your browser and navigate to `http://localhost:3000` to access the frontend.
2. Use the admin panel to manage users and generate salary slips.

## API Endpoints

### User Management

- **Add User**
    - `POST /add_user`
    - Request Body: `{ "username": "string", "email": "string", "password": "string", "role": "string" }`
    - Response: `{ "message": "New user added successfully" }`

- **Delete User**
    - `POST /delete_user`
    - Request Body: `{ "user_id": "integer" }`
    - Response: `{ "message": "User deleted successfully" }`

- **Update User Role**
    - `POST /update_role`
    - Request Body: `{ "user_id": "integer", "role": "string" }`
    - Response: `{ "message": "User role updated successfully" }`

- **Get Users**
    - `GET /get_users`
    - Response: `[{ "id": "integer", "username": "string", "email": "string", "role": "string" }]`

- **Get User by ID**
    - `GET /user/<int:user_id>`
    - Response: `{ "id": "integer", "username": "string", "email": "string", "role": "string" }`

### Salary Slip Generation

- **Generate Salary Slip for Single Employee**
    - `POST /generate-salary-slip-single`
    - Request Body: `{ "sheet_id_salary": "string", "sheet_id_drive": "string", "full_month": "string", "full_year": "string", "employee_identifier": "string", "send_whatsapp": "boolean", "send_email": "boolean" }`
    - Response: `{ "message": "Salary slip generated successfully!" }`

- **Generate Salary Slips in Batch**
    - `POST /generate-salary-slips-batch`
    - Request Body: `{ "sheet_id_salary": "string", "sheet_id_drive": "string", "full_month": "string", "full_year": "string", "send_whatsapp": "boolean", "send_email": "boolean" }`
    - Response: `{ "message": "Batch salary slips generated successfully!" }`

### Logs

- **Get Logs**
    - `GET /get-logs`
    - Response: Logs streamed as plain text

### Home

- **Home**
    - `GET /`
    - Response: `{ "message": "Welcome to the Salary Slip Automation API!" }`

## Frontend Components

- **App.jsx**: Main application component
- **Login.jsx**: Login component
- **Dashboard.jsx**: Admin panel for managing users and generating salary slips
- **Settings.jsx**: User settings component
- **ProtectedRoute.jsx**: Component for protecting routes based on user roles
- **AuthContext.jsx**: Context for managing authentication state

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.
