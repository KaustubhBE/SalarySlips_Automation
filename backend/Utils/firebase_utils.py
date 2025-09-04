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

def add_user(username, email, role, password_hash, client_id=None, client_secret=None, app_password=None, permissions=None):
    """Add a new user to Firestore"""
    user_data = {
        'username': username,
        'email': email,
        'role': role,
        'password_hash': password_hash
    }
    if client_id:
        user_data['client_id'] = client_id
    if client_secret:
        user_data['client_secret'] = client_secret
    if app_password:
        user_data['app_password'] = app_password
    if permissions:
        user_data['permissions'] = permissions
    user_ref = db.collection('USERS').document()
    user_ref.set(user_data)
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

def update_user_comprehensive_permissions(user_id, permissions_data):
    """Update user permissions only"""
    user_ref = db.collection('USERS').document(user_id)
    
    update_data = {}
    if 'permissions' in permissions_data:
        update_data['permissions'] = permissions_data['permissions']
    
    if update_data:
        user_ref.update(update_data)

def update_user_app_password(user_id, app_password):
    """Update a user's app password"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'app_password': app_password})

def get_smtp_credentials_by_email(email):
    """Get the sender email and app password for SMTP for a user by their email."""
    user = get_user_by_email(email)
    if user:
        return user.get('email'), user.get('app_password')
    return None, None

def update_user_password(user_id, password_hash):
    """Update a user's password hash"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'password_hash': password_hash})

# Removed update_user_departments - no longer needed with tree_permissions only

def update_user(user_id, **kwargs):
    """Update multiple user fields at once"""
    user_ref = db.collection('USERS').document(user_id)
    # Filter out None values
    update_data = {k: v for k, v in kwargs.items() if v is not None}
    if update_data:
        user_ref.update(update_data)
