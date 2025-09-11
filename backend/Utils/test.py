import os
import sys
import logging

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firebase_admin import firestore
from Utils.firebase_utils import db

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_material_data(file_path):
    """
    Parse the material data from data.md file
    Returns a dictionary with factory names as keys and material lists as values
    """
    materials_by_factory = {}
    
    # Define factory mappings
    factory_mapping = {
        'gulbarga': 'GULBARGA',
        'kerur': 'KERUR', 
        'omkar': 'OMKAR',
        'humnabad': 'HUMNABAD',
        'padmavati': 'PADMAVATI',
        'headoffice': 'HEADOFFICE'
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        current_factory = None
        material_id = 1
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Split by tab character
            parts = line.split('\t')
            
            # Check if we have at least 5 parts (Category, Sub Category, Particulars, Material Name, UOM)
            if len(parts) >= 5:
                category = parts[0].strip()
                sub_category = parts[1].strip() if len(parts) > 1 else ''
                particulars = parts[2].strip() if len(parts) > 2 else ''
                material_name = parts[3].strip() if len(parts) > 3 else ''
                uom = parts[4].strip() if len(parts) > 4 else ''
                
                # Skip if any required field is empty
                if not category or not material_name or not uom:
                    logger.warning(f"Line {line_num}: Skipping incomplete record - {line}")
                    continue
                
                # For now, we'll assign all materials to KERUR factory
                # You can modify this logic based on your requirements
                factory_name = 'KERUR'
                
                if factory_name not in materials_by_factory:
                    materials_by_factory[factory_name] = []
                
                material_data = {
                    'id': material_id,
                    'category': category,
                    'sub_category': sub_category,
                    'particulars': particulars,
                    'material_name': material_name,
                    'uom': uom,
                    'created_at': firestore.SERVER_TIMESTAMP
                }
                
                materials_by_factory[factory_name].append(material_data)
                material_id += 1
                
                logger.info(f"Processed: {material_name} - {category}")
    
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return {}
    except Exception as e:
        logger.error(f"Error parsing file: {str(e)}")
        return {}
    
    return materials_by_factory

def push_materials_to_firebase(materials_by_factory):
    """
    Push material data to Firebase Firestore
    Structure: MaterialList -> FactoryName -> Materials
    """
    try:
        # Reference to the MaterialList collection
        material_list_ref = db.collection('MaterialList')
        
        for factory_name, materials in materials_by_factory.items():
            logger.info(f"Pushing {len(materials)} materials to factory: {factory_name}")
            
            # Create a batch for this factory
            batch = db.batch()
            
            # Create a document for this factory
            factory_doc_ref = material_list_ref.document(factory_name)
            
            # Prepare factory data
            factory_data = {
                'factory_name': factory_name,
                'total_materials': len(materials),
                'created_at': firestore.SERVER_TIMESTAMP,
                'last_updated': firestore.SERVER_TIMESTAMP
            }
            
            # Set the factory document
            batch.set(factory_doc_ref, factory_data)
            
            # Create a subcollection for materials under this factory
            materials_collection_ref = factory_doc_ref.collection('materials')
            
            # Add each material as a document in the subcollection
            for material in materials:
                material_doc_ref = materials_collection_ref.document(f"material_{material['id']}")
                batch.set(material_doc_ref, material)
            
            # Commit the batch
            batch.commit()
            logger.info(f"Successfully pushed {len(materials)} materials to {factory_name}")
    
    except Exception as e:
        logger.error(f"Error pushing to Firebase: {str(e)}")
        raise

def create_material_categories_index(materials_by_factory):
    """
    Create an index of categories for easier querying
    """
    try:
        for factory_name, materials in materials_by_factory.items():
            # Get unique categories
            categories = list(set(material['category'] for material in materials))
            
            # Create categories index document
            categories_ref = db.collection('MaterialList').document(factory_name).collection('indexes').document('categories')
            categories_ref.set({
                'categories': categories,
                'total_categories': len(categories),
                'last_updated': firestore.SERVER_TIMESTAMP
            })
            
            logger.info(f"Created categories index for {factory_name}: {len(categories)} categories")
    
    except Exception as e:
        logger.error(f"Error creating categories index: {str(e)}")

def main():
    """
    Main function to execute the data migration
    """
    # Get the path to data.md file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_file_path = os.path.join(current_dir, '..', '..', 'frontend', 'src', 'KR_Departments', 'data.md')
    
    logger.info("Starting material data migration to Firebase...")
    logger.info(f"Data file path: {data_file_path}")
    
    # Check if file exists
    if not os.path.exists(data_file_path):
        logger.error(f"Data file not found at: {data_file_path}")
        return
    
    # Parse the material data
    logger.info("Parsing material data...")
    materials_by_factory = parse_material_data(data_file_path)
    
    if not materials_by_factory:
        logger.error("No materials found to process")
        return
    
    # Log summary
    total_materials = sum(len(materials) for materials in materials_by_factory.values())
    logger.info(f"Parsed {total_materials} materials across {len(materials_by_factory)} factories")
    
    for factory_name, materials in materials_by_factory.items():
        logger.info(f"  - {factory_name}: {len(materials)} materials")
    
    # Push to Firebase
    logger.info("Pushing materials to Firebase...")
    push_materials_to_firebase(materials_by_factory)
    
    # Create categories index
    logger.info("Creating categories index...")
    create_material_categories_index(materials_by_factory)
    
    logger.info("Material data migration completed successfully!")

if __name__ == "__main__":
    main()
