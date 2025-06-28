import firebase_admin
from firebase_admin import credentials, firestore
import os
from Utils.config import get_resource_path

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
    query = users_ref.where('email', '==', email).limit(1)
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
    query = slips_ref.where('user_id', '==', user_id)
    results = query.get()
    return [slip.to_dict() for slip in results]

def update_user_permissions(user_id, permissions):
    """Update a user's permissions"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'permissions': permissions}) 

def update_user_base64_token(user_id, base64_token):
    """Update user's BASE64 encrypted token in Firestore"""
    try:
        user_ref = db.collection('USERS').document(user_id)
        user_ref.update({'base64_token': base64_token}, merge=True)
        # print(f"BASE64 length: {len(base64_token)}")
        # user_ref.set({'base64_token': base64_token}, merge=True)
        return True
    except Exception as e:
        print(f"Error updating BASE64 token in Firestore: {e}")
        return False

def get_user_base64_token(user_id):
    """Get user's BASE64 encrypted token from Firestore"""
    try:
        user_ref = db.collection('USERS').document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            return user_data.get('base64_token')
        return None
    except Exception as e:
        print(f"Error getting BASE64 token from Firestore: {e}")
        return None