import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import os
from Utils.config import get_resource_path
import logging

# Initialize Firebase Admin SDK
cred = credentials.Certificate(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firebase-admin-sdk.json'))
firebase_admin.initialize_app(cred)

# Get Firestore client
db = firestore.client()

def add_user(username, email, role, password_hash):
    """Add a new user to Firestore"""
    user_ref = db.collection('USERS').document()
    user_ref.set({
        'username': username,
        'email': email,
        'role': role,
        'password_hash': password_hash
    })
    return user_ref.id

def get_user_by_id(user_id):
    """Get a user by their ID"""
    user_ref = db.collection('USERS').document(user_id)
    user = user_ref.get()
    if user.exists:
        return user.to_dict()
    return None

def get_user_by_email(email):
    """Get a user by their email"""
    users_ref = db.collection('USERS')
    query = users_ref.where(filter=FieldFilter('email', '==', email)).limit(1)
    results = query.get()
    if results:
        user_doc = results[0]
        user_data = user_doc.to_dict()
        user_data['id'] = user_doc.id
        return user_data
    return None

def get_all_users():
    """Get all users"""
    users_ref = db.collection('USERS')
    users = users_ref.get()
    return [{**user.to_dict(), 'docId': user.id} for user in users]

def update_user_role(user_id, new_role):
    """Update a user's role"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'role': new_role})

def delete_user(user_id):
    """Delete a user"""
    db.collection('USERS').document(user_id).delete()

def add_salary_slip(slip_data):
    """Add a salary slip to Firestore"""
    slip_ref = db.collection('salary_slips').document()
    slip_ref.set(slip_data)
    return slip_ref.id

def get_salary_slips_by_user(user_id):
    """Get all salary slips for a user"""
    slips_ref = db.collection('salary_slips')
    query = slips_ref.where(filter=FieldFilter('user_id', '==', user_id))
    results = query.get()
    return [slip.to_dict() for slip in results]

def update_user_permissions(user_id, permissions):
    """Update a user's permissions"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'permissions': permissions})

def update_user_token(user_id, oauth_credentials):
    try:
        user_ref = db.collection('USERS').document(user_id)
        user_ref.update({'token': oauth_credentials})
        return True
    except Exception as e:
        logging.error(f"Error updating google_oauth in Firestore: {e}")
        return False

def get_user_token(user_id):
    try:
        user_ref = db.collection('USERS').document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            return user_data.get('token')
        return None
    except Exception as e:
        logging.error(f"Error getting google_oauth from Firestore: {e}")
        return None

def get_user_token_by_email(email):
    user = get_user_by_email(email)
    if user:
        return user.get('token')
    return None

def check_user_token_status(email):
    """Check if a user has a valid token and return status information"""
    user = get_user_by_email(email)
    if not user:
        return {
            'exists': False,
            'has_token': False,
            'message': f'User with email {email} not found in database'
        }
    token = user.get('token')
    if not token:
        return {
            'exists': True,
            'has_token': False,
            'message': f'User {email} exists but has no token stored'
        }
    return {
        'exists': True,
        'has_token': True,
        'token': token,
        'message': f'User {email} has a token stored'
    }