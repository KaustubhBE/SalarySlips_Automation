import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import os
from Utils.config import get_resource_path
import logging
from datetime import datetime

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
                            mat for mat in category_materials 
                            if mat['subCategory'] == sub_cat and mat['particulars'] == particular
                        ]
                        if materials_for_particular:
                            material_data[category]['materialNames'][sub_cat][particular] = materials_for_particular
            elif particulars and not sub_categories:
                # Simple nested structure: particulars -> materials
                material_data[category]['materialNames'] = {}
                for particular in particulars:
                    materials_for_particular = [
                        mat for mat in category_materials 
                        if mat['particulars'] == particular
                    ]
                    if materials_for_particular:
                        material_data[category]['materialNames'][particular] = materials_for_particular
            else:
                # Simple array structure: just material objects with UOM
                material_data[category]['materialNames'] = category_materials
        
        return material_data
        
    except Exception as e:
        logging.error(f"Error fetching material data for factory {factory_name}: {str(e)}")
        return {}

# Order management functions
def get_factory_initials(factory_name):
    """Convert factory name to initials for document naming"""
    factory_mapping = {
        'KR': 'KR',
        'Kerur': 'KR', 
        'Gulbarga': 'GB',
        'Humnabad': 'HB',
        'Omkar': 'OM',
        'Padmavati': 'PV',
        'Head Office': 'HO'
    }
    return factory_mapping.get(factory_name, factory_name[:2].upper())


def get_next_order_id(factory):
    """
    Get the next order ID for a factory using atomic counter
    Returns the next available order ID in format: KR_MMYY-nnnn
    """
    try:
        factory_initials = get_factory_initials(factory)
        counter_ref = db.collection('ORDER_COUNTERS').document(factory_initials)
        
        # Use transaction to ensure atomic increment
        @firestore.transactional
        def update_counter(transaction):
            counter_doc = counter_ref.get(transaction=transaction)
            
            if counter_doc.exists:
                current_data = counter_doc.to_dict()
                current_count = current_data.get('count', 0)
                new_count = current_count + 1
                logging.info(f"Counter exists for {factory}: current={current_count}, new={new_count}")
            else:
                new_count = 1
                logging.info(f"Counter does not exist for {factory}, starting with count=1")
            
            # Update the counter
            transaction.set(counter_ref, {
                'count': new_count,
                'factory': factory,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            }, merge=True)
            
            return new_count
        
        # Execute the transaction
        transaction = db.transaction()
        new_count = update_counter(transaction)
        
        # Generate order ID with the new count
        from datetime import datetime
        now = datetime.utcnow()
        month = now.month
        year = now.year % 100  # Last 2 digits of year
        
        order_id = f"{factory_initials}_{month:02d}{year:02d}-{new_count:04d}"
        
        logging.info(f"Generated new order ID for {factory}: {order_id} (count: {new_count}, month: {month:02d}, year: {year:02d})")
        return order_id
        
    except Exception as e:
        logging.error(f"Error generating order ID for {factory}: {str(e)}", exc_info=True)
        # Fallback to timestamp-based ID if counter fails
        from datetime import datetime
        now = datetime.utcnow()
        timestamp = int(now.timestamp() * 1000)  # milliseconds
        fallback_id = f"{factory_initials}_{now.month:02d}{now.year % 100:02d}-{timestamp % 10000:04d}"
        logging.warning(f"Using fallback order ID: {fallback_id}")
        return fallback_id


def reset_order_counter(factory):
    """
    Reset the order counter for a factory to 0
    This should only be used for testing or if counter gets corrupted
    """
    try:
        factory_initials = get_factory_initials(factory)
        counter_ref = db.collection('ORDER_COUNTERS').document(factory_initials)
        
        counter_ref.set({
            'count': 0,
            'factory': factory,
            'lastUpdated': firestore.SERVER_TIMESTAMP
        })
        
        logging.info(f"Reset order counter for {factory} to 0")
        return True
        
    except Exception as e:
        logging.error(f"Error resetting order counter for {factory}: {str(e)}", exc_info=True)
        return False


def add_order(factory, order_data):
    """Add a new order to the ORDERS collection under factory document"""
    try:
        factory_initials = get_factory_initials(factory)
        orders_ref = db.collection('ORDERS').document(factory_initials)
        orders_doc = orders_ref.get()
        
        if orders_doc.exists:
            # Get existing orders array
            existing_data = orders_doc.to_dict()
            orders = existing_data.get('orders', [])
        else:
            # Create new factory document with empty orders array
            orders = []
        
        # Create a clean order data with regular timestamps (not SERVER_TIMESTAMP)
        current_time = datetime.utcnow()
        
        # Clean order items by removing frontend-specific IDs
        order_items = order_data.get('orderItems', [])
        cleaned_order_items = []
        for item in order_items:
            cleaned_item = {
                'category': item.get('category'),
                'subCategory': item.get('subCategory'),
                'particulars': item.get('particulars'),
                'materialName': item.get('materialName'),
                'uom': item.get('uom'),
                'quantity': item.get('quantity')
            }
            cleaned_order_items.append(cleaned_item)
        
        clean_order_data = {
            'orderId': order_data.get('orderId'),
            'orderItems': cleaned_order_items,  # Use cleaned items without frontend IDs
            'givenBy': order_data.get('givenBy'),
            'description': order_data.get('description'),
            'importance': order_data.get('importance'),
            'factory': order_data.get('factory'),
            'createdBy': order_data.get('createdBy'),
            'status': order_data.get('status'),
            'createdAt': current_time,  # Use regular datetime
            'submittedAt': current_time  # Use regular datetime
        }
        
        logging.info(f"Adding order to factory {factory} (document: {factory_initials}): {clean_order_data['orderId']}")
        
        # Add new order to the array
        orders.append(clean_order_data)
        
        # Update the factory document with the new orders array
        orders_ref.set({
            'orders': orders,
            'factory': factory,
            'lastUpdated': firestore.SERVER_TIMESTAMP
        }, merge=True)
        
        logging.info(f"Successfully added order {clean_order_data['orderId']} to factory {factory}")
        return True
    except Exception as e:
        logging.error(f"Error adding order: {str(e)}", exc_info=True)
        return False

def get_orders_by_factory(factory):
    """Get all orders for a specific factory"""
    try:
        factory_initials = get_factory_initials(factory)
        orders_ref = db.collection('ORDERS').document(factory_initials)
        orders_doc = orders_ref.get()
        
        if not orders_doc.exists:
            return []
        
        factory_data = orders_doc.to_dict()
        orders = factory_data.get('orders', [])
        
        # Add document ID to each order for reference
        for i, order in enumerate(orders):
            order['orderIndex'] = i
            order['factory'] = factory_data.get('factory', factory)
        
        return orders
    except Exception as e:
        logging.error(f"Error fetching orders for factory {factory}: {str(e)}")
        return []

def get_order_by_id(factory, order_id):
    """Get a specific order by ID from a factory"""
    try:
        orders = get_orders_by_factory(factory)
        for order in orders:
            if order.get('orderId') == order_id:
                return order
        return None
    except Exception as e:
        logging.error(f"Error fetching order {order_id} for factory {factory}: {str(e)}")
        return None

def update_order_status(factory, order_id, new_status, updated_by=None):
    """Update the status of a specific order"""
    try:
        factory_initials = get_factory_initials(factory)
        orders_ref = db.collection('ORDERS').document(factory_initials)
        orders_doc = orders_ref.get()
        
        if not orders_doc.exists:
            return False
        
        factory_data = orders_doc.to_dict()
        orders = factory_data.get('orders', [])
        
        # Find and update the order
        current_time = datetime.utcnow()
        
        for i, order in enumerate(orders):
            if order.get('orderId') == order_id:
                orders[i]['status'] = new_status
                orders[i]['updatedAt'] = current_time  # Use regular datetime
                if updated_by:
                    orders[i]['updatedBy'] = updated_by
                break
        else:
            return False
        
        # Update the document
        orders_ref.set({
            'orders': orders,
            'lastUpdated': firestore.SERVER_TIMESTAMP
        }, merge=True)
        
        return True
    except Exception as e:
        logging.error(f"Error updating order status: {str(e)}")
        return False

def delete_order(factory, order_id):
    """Delete a specific order from a factory"""
    try:
        factory_initials = get_factory_initials(factory)
        orders_ref = db.collection('ORDERS').document(factory_initials)
        orders_doc = orders_ref.get()
        
        if not orders_doc.exists:
            return False
        
        factory_data = orders_doc.to_dict()
        orders = factory_data.get('orders', [])
        
        # Find and remove the order
        original_length = len(orders)
        orders = [order for order in orders if order.get('orderId') != order_id]
        
        if len(orders) == original_length:
            return False  # Order not found
        
        # Update the document
        orders_ref.set({
            'orders': orders,
            'lastUpdated': firestore.SERVER_TIMESTAMP
        }, merge=True)
        
        return True
    except Exception as e:
        logging.error(f"Error deleting order: {str(e)}")
        return False

def get_all_orders():
    """Get all orders from all factories"""
    try:
        all_orders = []
        orders_ref = db.collection('ORDERS')
        orders_docs = orders_ref.get()
        
        for doc in orders_docs:
            factory_data = doc.to_dict()
            orders = factory_data.get('orders', [])
            factory = factory_data.get('factory', doc.id)
            
            for order in orders:
                order['factory'] = factory
                order['factoryDocument'] = doc.id
                all_orders.append(order)
        
        return all_orders
    except Exception as e:
        logging.error(f"Error fetching all orders: {str(e)}")
        return []
