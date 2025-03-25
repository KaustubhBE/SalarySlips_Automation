import os
import logging
from fastapi import FastAPI, Request, Response, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from logging.handlers import RotatingFileHandler
from Utils.fetch_data import fetch_google_sheet_data
from Utils.salary_slips_utils import process_salary_slip, process_salary_slips
from google.oauth2 import service_account
from googleapiclient.discovery import build
from Utils.config import CLIENT_SECRETS_FILE, drive
from Utils.setup_db import initialize_database
from Utils.db_utils import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from typing import Optional, Union
from pydantic import BaseModel, validator, field_validator

# Initialize FastAPI app
app = FastAPI()

# CORS configuration for Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://salary-slips-automation-frontend.onrender.com"  # Production frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load configurations
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.getenv("OUTPUT_DIR", os.path.join(BASE_DIR, "Salary_Slips"))
TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", os.path.join(BASE_DIR, "ssformat.docx"))
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", os.path.join(BASE_DIR, "app.log"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configure logging
logger = logging.getLogger("app")
if not logger.handlers:
    handler = RotatingFileHandler(LOG_FILE_PATH, maxBytes=10*1024*1024, backupCount=5)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    handler.propagate = False

# Mount static files
static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'dist')
os.makedirs(static_folder, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_folder), name="static")

# Pydantic models for request validation
class UserCreate(BaseModel):
    username: str
    email: str
    role: str
    password: str

class UserUpdate(BaseModel):
    user_id: int
    role: str

class SalarySlipRequest(BaseModel):
    sheet_id_salary: str
    sheet_id_drive: str
    full_month: str
    full_year: Union[str, int]  # Accept both string and integer
    employee_identifier: Optional[str] = None
    send_whatsapp: bool = False
    send_email: bool = False

    @field_validator('full_year')
    @classmethod
    def validate_full_year(cls, v):
        # Convert to string if it's an integer
        if isinstance(v, int):
            return str(v)
        return v

# Dependency for user role
async def get_user_role(x_user_role: str = Header(None)):
    return x_user_role or 'user'

# Dependency for checking user role
async def check_user_role(required_role: str, user_role: str = Depends(get_user_role)):
    if user_role != required_role:
        raise HTTPException(status_code=403, detail="Access denied")
    return user_role

def get_drive_service():
    try:
        credentials = service_account.Credentials.from_service_account_file(CLIENT_SECRETS_FILE)
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"Error initializing Google Drive service: {e}")
        raise

# Frontend routes
@app.get("/")
async def serve_root():
    return FileResponse(os.path.join(static_folder, "index.html"))

@app.get("/{path:path}")
async def serve(path: str):
    if path.startswith('api/'):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        return FileResponse(os.path.join(static_folder, path))
    except:
        return FileResponse(os.path.join(static_folder, "index.html"))

# API routes
@app.post("/api/add_user")
async def add_user(user: UserCreate):
    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                     (user.username, user.email, generate_password_hash(user.password), user.role))
        conn.commit()
        conn.close()
        return {"message": "User added successfully"}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete_user")
async def delete_user(user_id: int):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        return {"message": "User deleted successfully"}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update_role")
async def update_role(user_update: UserUpdate):
    try:
        conn = get_db_connection()
        conn.execute('UPDATE users SET role = ? WHERE id = ?', (user_update.role, user_update.user_id))
        conn.commit()
        conn.close()
        return {"message": "Role updated successfully"}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get_users")
async def get_users():
    try:
        conn = get_db_connection()
        users = conn.execute('SELECT id, username, email, role FROM users').fetchall()
        conn.close()
        return [dict(user) for user in users]
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{user_id}")
async def get_user(user_id: int):
    try:
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(user)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-salary-slip-single")
async def generate_salary_slip_single(
    request: SalarySlipRequest,
    user_role: str = Depends(lambda: check_user_role('user'))
):
    try:
        logger.info("Processing single salary slip request")
        
        # Fetch data
        try:
            salary_data = fetch_google_sheet_data(request.sheet_id_salary, request.full_month[:3])
            drive_data = fetch_google_sheet_data(request.sheet_id_drive, "Official Details")
            email_data = fetch_google_sheet_data(request.sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(request.sheet_id_drive, "Onboarding Details")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching data: {e}")

        if not all([salary_data, drive_data, email_data, contact_data]):
            raise HTTPException(status_code=500, detail="Failed to fetch required data")

        # Process data
        salary_headers = (salary_data[1])
        employees = salary_data[2:]

        drive_headers = (drive_data[1])
        drive_employees = [dict(zip(drive_headers, row)) for row in drive_data[2:]]

        email_headers = (email_data[1])
        email_employees = [dict(zip(email_headers, row)) for row in email_data[2:]]

        contact_headers = (contact_data[1])
        contact_employees = [dict(zip(contact_headers, row)) for row in contact_data[2:]]

        # Find employee
        employee = next((emp for emp in drive_employees 
                        if emp.get('Employee Code') == request.employee_identifier 
                        or emp.get('Name') == request.employee_identifier), None)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found in records")

        salary_employee = next((emp for emp in employees 
                              if emp[salary_headers.index('Employee Code')] == request.employee_identifier 
                              or emp[salary_headers.index('Name')] == request.employee_identifier), None)
        if not salary_employee:
            raise HTTPException(status_code=404, detail="Employee salary data not found")

        # Process salary slip
        try:
            employee_data = [str(item) if item is not None else '' for item in salary_employee]
            process_salary_slip(
                template_path=TEMPLATE_PATH,
                output_dir=OUTPUT_DIR,
                employee_data=employee_data,
                headers=salary_headers,
                drive_data=drive_employees,
                email_employees=email_employees,
                contact_employees=contact_employees,
                month=request.full_month[:3],
                year=str(request.full_year)[-2:],
                full_month=request.full_month,
                full_year=request.full_year,
                send_whatsapp=request.send_whatsapp,
                send_email=request.send_email
            )
            return {"message": "Salary slip generated successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing salary slip: {e}")

    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-salary-slips-batch")
async def generate_salary_slips_batch(request: SalarySlipRequest):
    try:
        logger.info("Processing batch salary slips request")
        
        # Fetch data
        try:
            salary_data = fetch_google_sheet_data(request.sheet_id_salary, request.full_month[:3])
            drive_data = fetch_google_sheet_data(request.sheet_id_drive, "Official Details")
            email_data = fetch_google_sheet_data(request.sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(request.sheet_id_drive, "Onboarding Details")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching data: {e}")

        if not all([salary_data, drive_data, email_data, contact_data]):
            raise HTTPException(status_code=500, detail="Failed to fetch required data")

        # Process data
        salary_headers = (salary_data[1])
        employees = salary_data[2:]

        drive_headers = (drive_data[1])
        drive_employees = [dict(zip(drive_headers, row)) for row in drive_data[2:]]

        email_headers = (email_data[1])
        email_employees = [dict(zip(email_headers, row)) for row in email_data[2:]]

        contact_headers = (contact_data[1])
        contact_employees = [dict(zip(contact_headers, row)) for row in contact_data[2:]]

        # Generate salary slips for each employee
        for employee in employees:
            employee_name = employee[4]  # Assuming the employee name is at index 4
            logger.info(f"Processing salary slip for employee: {employee_name}")
            try:
                employee_data = [str(item) if item is not None else '' for item in employee]
                process_salary_slip(
                    template_path=TEMPLATE_PATH,
                    output_dir=OUTPUT_DIR,
                    employee_data=employee_data,
                    headers=salary_headers,
                    drive_data=drive_employees,
                    email_employees=email_employees,
                    contact_employees=contact_employees,
                    month=request.full_month[:3],
                    year=str(request.full_year)[-2:],
                    full_month=request.full_month,
                    full_year=request.full_year,
                    send_whatsapp=request.send_whatsapp,
                    send_email=request.send_email
                )
                logger.info(f"Uploaded {employee_name}'s salary slip to folder {OUTPUT_DIR}")
                if request.send_email:
                    logger.info(f"Sending email to {employee[5]}")
                    logger.info(f"Email sent to {employee[5]}")
                if request.send_whatsapp:
                    logger.info(f"Sending WhatsApp message to {employee[6]}")
            except Exception as e:
                error_msg = f"Error processing salary slip for employee {employee_name}: {e}"
                logger.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)

        return {"message": "Batch salary slips generated successfully"}

    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-logs")
async def get_logs():
    try:
        with open(LOG_FILE_PATH, "r") as log_file:
            logs = log_file.read()
        return Response(content=logs, media_type="text/plain")
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to read logs")

@app.get("/api/")
async def home():
    return {"message": "Welcome to the Salary Slip Automation API!"}

@app.post("/api/auth/login")
async def login(request: Request):
    try:
        data = await request.json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password are required")
            
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            user_data = {
                'id': user['id'],
                'email': user['email'],
                'username': user['username'],
                'role': user['role']
            }
            return {
                "success": True,
                "user": user_data
            }
        
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/healthz")
async def health_check():
    return {"status": "healthy"}

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 5000))
    uvicorn.run(app, host='0.0.0.0', port=port)