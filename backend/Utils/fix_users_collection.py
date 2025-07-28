import firebase_admin
from firebase_admin import credentials, firestore
import os
from werkzeug.security import generate_password_hash

# Initialize Firebase Admin SDK
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), '..', 'firebase-admin-sdk.json'))
firebase_admin.initialize_app(cred)

# Get Firestore client
db = firestore.client()

# Define departments as per Dashboard.jsx
DEPARTMENTS = {
    'STORE': 'store',
    'MARKETING': 'marketing',
    'HUMANRESOURCE': 'humanresource'
}

# Define roles and their default permissions (aligned with Dashboard.jsx)
ROLES = {
    'super-admin': {
        'reports': True,
        'settings_access': True,
        'user_management': True,
        'can_create_admin': True,
        'inventory': True,
        'single_processing': True,
        'batch_processing': True,
        'marketing_campaigns': True,
        'expense_management': True
    },
    'admin': {
        'reports': True,
        'settings_access': True,
        'user_management': True,
        'can_create_admin': False
    },
    'user': {
        'reports': False  # Will be overridden by department permissions
    }
}

# Department-based default permissions (aligned with Dashboard.jsx)
DEPARTMENT_DEFAULT_PERMISSIONS = {
    DEPARTMENTS['STORE']: {
        'reports': True,
        'inventory': True
    },
    DEPARTMENTS['MARKETING']: {
        'reports': True,
        'marketing_campaigns': True
    },
    DEPARTMENTS['HUMANRESOURCE']: {
        'single_processing': True,
        'batch_processing': True,
        'reports': True
    }
}

def create_user(users_ref, username, email, password, role, department=None, app_password=None):
    # Get base permissions for role
    permissions = ROLES[role].copy()
    
    # If user role and has department, override with department permissions
    if role == 'user' and department and department in DEPARTMENT_DEFAULT_PERMISSIONS:
        permissions = DEPARTMENT_DEFAULT_PERMISSIONS[department].copy()
    
    user_data = {
        'username': username,
        'email': email,
        'password_hash': generate_password_hash(password),
        'role': role,
        'permissions': permissions
    }
    
    # Add department if provided (not for super-admin)
    if department and role != 'super-admin':
        user_data['department'] = department
    
    # Add app password if provided
    if app_password:
        user_data['app_password'] = app_password
    
    users_ref.document().set(user_data)
    print("\nCreated {}{}:".format(role, f" ({department})" if department else ""))
    print("Email: {}".format(email))
    print("Password: {}".format(password))
    if app_password:
        print("App Password: {}".format(app_password))
    if department:
        print("Department: {}".format(department))
    print("Permissions:", user_data['permissions'])

def fix_users_collection():
    try:
        # Delete existing users collection
        users_ref = db.collection('USERS')
        docs = users_ref.get()
        for doc in docs:
            doc.reference.delete()
        print("Cleared existing users collection")

        print("\n" + "="*60)
        print("CREATING USERS WITH DASHBOARD.JSX ALIGNED PERMISSIONS")
        print("="*60)

        # Create super-admin (kaustubh) - No department needed
        create_user(
            users_ref,
            username='kaustubh',
            email='kaustubh@bajajearths.com',
            password='K@ustubh2003',
            role='super-admin',
            app_password='kaustubh_app_pass_2024'
        )

        # Create a sample admin - No department needed
        create_user(
            users_ref,
            username='admin',
            email='admin@bajajearths.com',
            password='Admin@2024',
            role='admin',
            app_password='admin_app_pass_2024'
        )

        # Create department-based users
        
        # Store Department User
        create_user(
            users_ref,
            username='store_user',
            email='store@bajajearths.com',
            password='Store@2024',
            role='user',
            department=DEPARTMENTS['STORE'],
            app_password='store_app_pass_2024'
        )

        # Marketing Department User
        create_user(
            users_ref,
            username='marketing_user',
            email='marketing@bajajearths.com',
            password='Marketing@2024',
            role='user',
            department=DEPARTMENTS['MARKETING'],
            app_password='marketing_app_pass_2024'
        )

        # HR Department User
        create_user(
            users_ref,
            username='hr_user',
            email='hr@bajajearths.com',
            password='HR@2024',
            role='user',
            department=DEPARTMENTS['HUMANRESOURCE'],
            app_password='hr_app_pass_2024'
        )

        # Create additional sample users for testing
        create_user(
            users_ref,
            username='store_manager',
            email='store.manager@bajajearths.com',
            password='StoreManager@2024',
            role='user',
            department=DEPARTMENTS['STORE'],
            app_password='store_mgr_app_2024'
        )

        create_user(
            users_ref,
            username='hr_assistant',
            email='hr.assistant@bajajearths.com',
            password='HRAssistant@2024',
            role='user',
            department=DEPARTMENTS['HUMANRESOURCE'],
            app_password='hr_asst_app_2024'
        )

        print("\n" + "="*60)
        print("USERS COLLECTION FIXED SUCCESSFULLY!")
        print("="*60)
        print("\nUser Hierarchy Created:")
        print("\n1. SUPER ADMIN (kaustubh@bajajearths.com):")
        print("   - Full system access")
        print("   - Can create/manage all users")
        print("   - All permissions enabled")
        print("   - No department restriction")
        
        print("\n2. ADMIN (admin@bajajearths.com):")
        print("   - Full access except creating super-admins")
        print("   - Can manage regular users")
        print("   - System settings access")
        print("   - No department restriction")
        
        print("\n3. DEPARTMENT USERS:")
        print("   a) STORE USERS:")
        print("      - store@bajajearths.com")
        print("      - store.manager@bajajearths.com")
        print("      - Permissions: reports + inventory")
        
        print("   b) MARKETING USERS:")
        print("      - marketing@bajajearths.com")
        print("      - Permissions: reports + marketing_campaigns")
        
        print("   c) HR USERS:")
        print("      - hr@bajajearths.com")
        print("      - hr.assistant@bajajearths.com")
        print("      - Permissions: reports + single_processing + batch_processing")
        
        print("\n" + "="*60)
        print("PERMISSION STRUCTURE:")
        print("="*60)
        
        print("\nSUPER-ADMIN PERMISSIONS:")
        for perm, value in ROLES['super-admin'].items():
            print(f"  - {perm}: {value}")
        
        print("\nADMIN PERMISSIONS:")
        for perm, value in ROLES['admin'].items():
            print(f"  - {perm}: {value}")
        
        print("\nDEPARTMENT PERMISSIONS:")
        for dept, perms in DEPARTMENT_DEFAULT_PERMISSIONS.items():
            print(f"\n  {dept.upper()} DEPARTMENT:")
            for perm, value in perms.items():
                print(f"    - {perm}: {value}")
        
        print("\n" + "="*60)
        print("Ready for Dashboard.jsx integration!")
        print("="*60)

    except Exception as e:
        print("Error fixing users collection: {}".format(str(e)))
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    fix_users_collection() 