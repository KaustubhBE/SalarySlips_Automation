import firebase_admin
from firebase_admin import credentials, firestore
import os
from werkzeug.security import generate_password_hash

# Initialize Firebase Admin SDK
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), '..', 'firebase-admin-sdk.json'))
firebase_admin.initialize_app(cred)

# Get Firestore client
db = firestore.client()

# Define roles and their default permissions
ROLES = {
    'super-admin': {
        'single_processing': True,
        'batch_processing': True,
        'user_management': True,
        'settings_access': True,
        'can_create_admin': True
    },
    'admin': {
        'single_processing': True,
        'batch_processing': True,
        'user_management': True,
        'settings_access': True,
        'can_create_admin': False
    },
    'user': {
        'single_processing': True,
        'batch_processing': False,
        'user_management': False,
        'settings_access': False,
        'can_create_admin': False
    }
}

def create_user(users_ref, username, email, password, role):
    user_data = {
        'username': username,
        'email': email,
        'password_hash': generate_password_hash(password),
        'role': role,
        'permissions': ROLES[role]
    }
    users_ref.document().set(user_data)
    print("\nCreated {}:".format(role))
    print("Email: {}".format(email))
    print("Password: {}".format(password))
    print("Permissions:", user_data['permissions'])

def fix_users_collection():
    try:
        # Delete existing users collection
        users_ref = db.collection('USERS')
        docs = users_ref.get()
        for doc in docs:
            doc.reference.delete()
        print("Cleared existing users collection")

        # Create super-admin (kaustubh)
        create_user(
            users_ref,
            username='kaustubh',
            email='kaustubh@bajajearths.com',
            password='K@ustubh2003',
            role='super-admin'
        )

        # Create a sample admin
        create_user(
            users_ref,
            username='admin',
            email='admin@bajajearths.com',
            password='Admin@2024',
            role='admin'
        )

        # Create a sample regular user
        create_user(
            users_ref,
            username='user',
            email='user@bajajearths.com',
            password='User@2024',
            role='user'
        )

        print("\nUsers collection fixed successfully!")
        print("\nHierarchy created:")
        print("1. Super Admin (kaustubh) - Full access + can create admins")
        print("2. Admin - Full access except creating admins")
        print("3. User - Basic access (single processing only)")

    except Exception as e:
        print("Error fixing users collection: {}".format(str(e)))

if __name__ == '__main__':
    fix_users_collection() 