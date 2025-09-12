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

def add_user(username, email, role, password_hash, client_id=None, client_secret=None, app_password=None, permission_metadata=None):
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
    if permission_metadata:
        user_data['permission_metadata'] = permission_metadata
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
    logging.info(f"Result {results}")
    if results:
        user_doc = results[0]
        user_data = user_doc.to_dict()
        user_data['id'] = user_doc.id
        return user_data
    return None

def get_user_by_email_with_metadata(email):
    """Get a user by their email with complete permission metadata for RBAC"""
    users_ref = db.collection('USERS')
    query = users_ref.where(filter=FieldFilter('email', '==', email)).limit(1)
    results = query.get()
    logging.info(f"Result {results}")
    if results:
        user_doc = results[0]
        user_data = user_doc.to_dict()
        user_data['id'] = user_doc.id
        
        # Ensure we have the complete RBAC structure
        if 'permission_metadata' not in user_data:
            user_data['permission_metadata'] = {}
        
        # Log the complete permission structure for debugging
        logging.info(f"User {email} permission_metadata: {user_data.get('permission_metadata')}")
        logging.info(f"User {email} tree_permissions: {user_data.get('tree_permissions')}")
        logging.info(f"User {email} basic permissions: {user_data.get('permissions')}")
        
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

def update_user_permission_metadata(user_id, permission_metadata):
    """Update a user's permission metadata"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'permission_metadata': permission_metadata})

def update_user_comprehensive_permissions(user_id, permission_metadata):
    """Update user permission metadata only"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'permission_metadata': permission_metadata})

def clean_user_permission_metadata(user_id):
    """Clean a users permisssion befor saving new"""
    user_ref = db.collection('USERS').document(user_id)
    user_ref.update({'permission_metadata':{}})

def update_user_permission_metadata(user_id, permission_metadata):
    """Update a user's permission metadata for RBAC"""
    user_ref = db.collection('USERS').document(user_id)
    
    # Log the update operation
    logging.info(f"Updating permission metadata for user {user_id}: {permission_metadata}")
    
    # This will completely overwrite existing permission_metadata
    user_ref.update({'permission_metadata': permission_metadata})
    logging.info(f"Successfully updated permission metadata for user {user_id}")

def update_user_complete_rbac(user_id, permission_metadata):
    """Update complete RBAC structure for a user"""
    user_ref = db.collection('USERS').document(user_id)
    
    # Log the update operation
    logging.info(f"Updating RBAC for user {user_id}:")
    logging.info(f"  - Permission metadata: {permission_metadata}")
    
    # Single atomic update that completely overwrites existing permission_metadata
    user_ref.update({'permission_metadata': permission_metadata})
    logging.info(f"Successfully updated RBAC for user {user_id}")

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

def get_material_data():
    """Get all material data from MATERIAL collection"""
    try:
        materials_ref = db.collection('MATERIAL')
        materials = materials_ref.get()
        
        material_data = {}
        
        for material_doc in materials:
            factory_name = material_doc.id
            material_data[factory_name] = {
                'subCategories': [],
                'particulars': [],
                'materialNames': []
            }
            
            # Get materials subcollection for this factory
            materials_subcollection = material_doc.reference.collection('materials')
            materials_docs = materials_subcollection.get()
            
            categories = set()
            sub_categories = set()
            particulars = set()
            material_names = []
            
            for mat_doc in materials_docs:
                mat_data = mat_doc.to_dict()
                
                # Extract category
                if 'category' in mat_data:
                    categories.add(mat_data['category'])
                
                # Extract sub-category
                if 'subCategory' in mat_data and mat_data['subCategory']:
                    sub_categories.add(mat_data['subCategory'])
                
                # Extract particulars
                if 'particulars' in mat_data and mat_data['particulars']:
                    particulars.add(mat_data['particulars'])
                
                # Extract material name
                if 'materialName' in mat_data:
                    material_names.append({
                        'name': mat_data['materialName'],
                        'category': mat_data.get('category', ''),
                        'subCategory': mat_data.get('subCategory', ''),
                        'particulars': mat_data.get('particulars', ''),
                        'uom': mat_data.get('uom', '')
                    })
            
            # Organize data by category
            material_data[factory_name] = {}
            for category in categories:
                material_data[factory_name][category] = {
                    'subCategories': [],
                    'particulars': [],
                    'materialNames': []
                }
                
                # Get sub-categories for this category
                category_sub_categories = set()
                category_particulars = set()
                category_materials = []
                
                for mat in material_names:
                    if mat['category'] == category:
                        if mat['subCategory']:
                            category_sub_categories.add(mat['subCategory'])
                        if mat['particulars']:
                            category_particulars.add(mat['particulars'])
                        category_materials.append(mat)
                
                material_data[factory_name][category]['subCategories'] = list(category_sub_categories)
                material_data[factory_name][category]['particulars'] = list(category_particulars)
                material_data[factory_name][category]['materialNames'] = category_materials
        
        return material_data
        
    except Exception as e:
        logging.error(f"Error fetching material data: {str(e)}")
        return {}

def get_material_data_by_factory(factory_name):
    """Get material data for a specific factory in the format expected by KR_PlaceOrder.jsx"""
    try:
        factory_ref = db.collection('MATERIAL').document(factory_name)
        factory_doc = factory_ref.get()
        
        if not factory_doc.exists:
            return {}
        
        # Get materials array directly from the factory document
        factory_data = factory_doc.to_dict()
        materials = factory_data.get('materials', [])
        
        if not materials:
            return {}
        
        material_data = {}
        categories = set()
        
        # First pass: collect all categories
        for material in materials:
            category = material.get('category', '')
            if category:
                categories.add(category)
        
        # Second pass: organize data by category in the format expected by KR_PlaceOrder.jsx
        for category in categories:
            material_data[category] = {
                'subCategories': [],
                'particulars': [],
                'materialNames': []  # Will be restructured based on data complexity
            }
            
            # Collect all materials for this category
            category_materials = []
            sub_categories = set()
            particulars = set()
            
            for material in materials:
                if material.get('category') == category:
                    if material.get('subCategory'):
                        sub_categories.add(material['subCategory'])
                    if material.get('particulars'):
                        particulars.add(material['particulars'])
                    
                    category_materials.append({
                        'name': material.get('materialName', ''),
                        'subCategory': material.get('subCategory', ''),
                        'particulars': material.get('particulars', ''),
                        'uom': material.get('uom', '')
                    })
            
            # Set subCategories and particulars
            material_data[category]['subCategories'] = list(sub_categories)
            material_data[category]['particulars'] = list(particulars)
            
            # Structure materialNames based on complexity
            # If we have subCategories and particulars, create nested structure
            if sub_categories and particulars:
                # Complex nested structure: subCategory -> particulars -> materials
                material_data[category]['materialNames'] = {}
                for sub_cat in sub_categories:
                    material_data[category]['materialNames'][sub_cat] = {}
                    for particular in particulars:
                        materials_for_particular = [
                            mat['name'] for mat in category_materials 
                            if mat['subCategory'] == sub_cat and mat['particulars'] == particular
                        ]
                        if materials_for_particular:
                            material_data[category]['materialNames'][sub_cat][particular] = materials_for_particular
            elif particulars and not sub_categories:
                # Simple nested structure: particulars -> materials
                material_data[category]['materialNames'] = {}
                for particular in particulars:
                    materials_for_particular = [
                        mat['name'] for mat in category_materials 
                        if mat['particulars'] == particular
                    ]
                    if materials_for_particular:
                        material_data[category]['materialNames'][particular] = materials_for_particular
            else:
                # Simple array structure: just material names
                material_data[category]['materialNames'] = [mat['name'] for mat in category_materials]
        
        return material_data
        
    except Exception as e:
        logging.error(f"Error fetching material data for factory {factory_name}: {str(e)}")
        return {}
