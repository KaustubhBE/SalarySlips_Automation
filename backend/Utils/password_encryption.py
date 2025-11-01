"""
Password Encryption Utility
Uses Fernet symmetric encryption to securely store passwords for retrieval
"""
from cryptography.fernet import Fernet
import os
import base64
import logging

logger = logging.getLogger(__name__)

# Path to persistent encryption key file
KEY_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.password_encryption_key')

def get_encryption_key():
    """Get or generate encryption key for password storage
    
    Priority:
    1. Environment variable PASSWORD_ENCRYPTION_KEY
    2. Persistent key file (.password_encryption_key)
    3. Generate new key and save to file (first time use)
    """
    # First, try environment variable
    key = os.getenv('PASSWORD_ENCRYPTION_KEY')
    
    if key:
        logger.info("[get_encryption_key] ✅ Using encryption key from environment variable")
        # Ensure key is bytes for Fernet
        if isinstance(key, str):
            key = key.encode()
        return Fernet(key)
    
    # Second, try to load from persistent key file
    if os.path.exists(KEY_FILE_PATH):
        try:
            with open(KEY_FILE_PATH, 'r') as f:
                key = f.read().strip()
            logger.info("[get_encryption_key] ✅ Loaded encryption key from persistent file")
            logger.info(f"[get_encryption_key] Key file path: {KEY_FILE_PATH}")
            if isinstance(key, str):
                key = key.encode()
            return Fernet(key)
        except Exception as e:
            logger.error(f"[get_encryption_key] ❌ Error reading key file: {e}")
            logger.warning("[get_encryption_key] Will generate new key")
    
    # Third, generate new key and save to file (first time use)
    logger.warning("[get_encryption_key] ⚠️ PASSWORD_ENCRYPTION_KEY not set in environment and key file not found")
    logger.info("[get_encryption_key] Generating new encryption key and saving to persistent file...")
    
    key_bytes = Fernet.generate_key()
    key_str = key_bytes.decode()
    
    try:
        # Save key to file for future use
        with open(KEY_FILE_PATH, 'w') as f:
            f.write(key_str)
        # Set restrictive permissions (readable only by owner)
        os.chmod(KEY_FILE_PATH, 0o600)
        logger.info(f"[get_encryption_key] ✅ Generated and saved encryption key to: {KEY_FILE_PATH}")
        logger.warning("[get_encryption_key] ⚠️ IMPORTANT: Backup this key file or set PASSWORD_ENCRYPTION_KEY environment variable!")
        logger.warning(f"[get_encryption_key] Generated key (first 20 chars): {key_str[:20]}...")
    except Exception as e:
        logger.error(f"[get_encryption_key] ❌ Error saving key file: {e}")
        logger.warning("[get_encryption_key] Key will be regenerated on next restart!")
    
    return Fernet(key_bytes)

def encrypt_password(password):
    """Encrypt a password for secure storage"""
    try:
        logger.info(f"[encrypt_password] Starting encryption (password length: {len(password) if password else 0})")
        fernet = get_encryption_key()
        encrypted = fernet.encrypt(password.encode())
        encrypted_str = encrypted.decode()
        logger.info(f"[encrypt_password] Encryption successful (encrypted length: {len(encrypted_str)})")
        logger.info(f"[encrypt_password] Encrypted password preview: {encrypted_str[:50]}...")
        return encrypted_str
    except Exception as e:
        logger.error(f"[encrypt_password] Error encrypting password: {e}", exc_info=True)
        raise

def decrypt_password(encrypted_password):
    """Decrypt a password from secure storage"""
    try:
        logger.info(f"[decrypt_password] Starting decryption")
        logger.info(f"[decrypt_password] Encrypted password provided: {bool(encrypted_password)}")
        
        if not encrypted_password:
            logger.warning(f"[decrypt_password] No encrypted password provided")
            return None
        
        logger.info(f"[decrypt_password] Encrypted password length: {len(encrypted_password)}")
        logger.info(f"[decrypt_password] Encrypted password preview: {encrypted_password[:50]}...")
        
        fernet = get_encryption_key()
        logger.info(f"[decrypt_password] Encryption key loaded successfully")
        
        decrypted = fernet.decrypt(encrypted_password.encode())
        decrypted_str = decrypted.decode()
        
        logger.info(f"[decrypt_password] Decryption successful (decrypted length: {len(decrypted_str)})")
        logger.info(f"[decrypt_password] Decrypted password preview: {'*' * len(decrypted_str[:5])}... (hidden for security)")
        
        return decrypted_str
    except Exception as e:
        logger.error(f"[decrypt_password] Error decrypting password: {e}", exc_info=True)
        logger.error(f"[decrypt_password] Encrypted password that failed: {encrypted_password[:100] if encrypted_password else 'None'}...")
        return None

