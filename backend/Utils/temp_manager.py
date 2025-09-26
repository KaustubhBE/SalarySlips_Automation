# temp_manager.py - Centralized temporary file management with user isolation
import os
import shutil
import logging
from typing import Optional, List
from datetime import datetime, timedelta

def get_user_temp_dir(user_email: str, base_output_dir: str) -> str:
    """
    Get user-specific temporary directory.
    Creates the directory if it doesn't exist.
    
    Args:
        user_email: User's email address (sanitized for directory name)
        base_output_dir: Base output directory path
        
    Returns:
        str: Path to user-specific temporary directory
    """
    try:
        # Sanitize user email for directory name
        sanitized_email = sanitize_email_for_directory(user_email)
        user_temp_dir = os.path.join(base_output_dir, f"{sanitized_email}_temp")
        
        # Create directory if it doesn't exist
        os.makedirs(user_temp_dir, exist_ok=True)
        
        logging.info(f"User temp directory: {user_temp_dir}")
        return user_temp_dir
        
    except Exception as e:
        logging.error(f"Error creating user temp directory for {user_email}: {e}")
        # Fallback to base temp directory
        fallback_dir = os.path.join(base_output_dir, "temp")
        os.makedirs(fallback_dir, exist_ok=True)
        return fallback_dir

def cleanup_user_temp_dir(user_email: str, base_output_dir: str) -> bool:
    """
    Clean up user-specific temporary directory.
    
    Args:
        user_email: User's email address
        base_output_dir: Base output directory path
        
    Returns:
        bool: True if cleanup was successful, False otherwise
    """
    try:
        sanitized_email = sanitize_email_for_directory(user_email)
        user_temp_dir = os.path.join(base_output_dir, f"{sanitized_email}_temp")
        
        if os.path.exists(user_temp_dir):
            shutil.rmtree(user_temp_dir)
            logging.info(f"Cleaned up user temp directory: {user_temp_dir}")
            return True
        else:
            logging.info(f"User temp directory does not exist: {user_temp_dir}")
            return True
            
    except Exception as e:
        logging.error(f"Error cleaning up user temp directory for {user_email}: {e}")
        return False

def cleanup_old_user_temp_dirs(base_output_dir: str, max_age_hours: int = 24) -> int:
    """
    Clean up old user temporary directories that are older than max_age_hours.
    
    Args:
        base_output_dir: Base output directory path
        max_age_hours: Maximum age in hours before cleanup
        
    Returns:
        int: Number of directories cleaned up
    """
    try:
        cleaned_count = 0
        max_age = timedelta(hours=max_age_hours)
        current_time = datetime.now()
        
        if not os.path.exists(base_output_dir):
            return 0
            
        for item in os.listdir(base_output_dir):
            if item.endswith('_temp'):
                item_path = os.path.join(base_output_dir, item)
                if os.path.isdir(item_path):
                    # Check directory age
                    dir_mtime = datetime.fromtimestamp(os.path.getmtime(item_path))
                    if current_time - dir_mtime > max_age:
                        try:
                            shutil.rmtree(item_path)
                            cleaned_count += 1
                            logging.info(f"Cleaned up old temp directory: {item_path}")
                        except Exception as e:
                            logging.error(f"Error cleaning up old temp directory {item_path}: {e}")
        
        return cleaned_count
        
    except Exception as e:
        logging.error(f"Error during old temp directories cleanup: {e}")
        return 0

def sanitize_email_for_directory(email: str) -> str:
    """
    Sanitize email address for use as directory name.
    
    Args:
        email: Email address to sanitize
        
    Returns:
        str: Sanitized email safe for directory name
    """
    if not email:
        return "unknown_user"
    
    # Replace @ with _at_ and remove other invalid characters
    sanitized = email.replace('@', '_at_')
    sanitized = ''.join(c for c in sanitized if c.isalnum() or c in '._-')
    
    # Ensure it's not empty and not too long
    if not sanitized:
        sanitized = "unknown_user"
    elif len(sanitized) > 50:
        sanitized = sanitized[:50]
    
    return sanitized

def get_user_temp_file_path(user_email: str, base_output_dir: str, filename: str) -> str:
    """
    Get full path for a file in user's temporary directory.
    
    Args:
        user_email: User's email address
        base_output_dir: Base output directory path
        filename: Name of the file
        
    Returns:
        str: Full path to the file in user's temp directory
    """
    user_temp_dir = get_user_temp_dir(user_email, base_output_dir)
    return os.path.join(user_temp_dir, filename)

def list_user_temp_files(user_email: str, base_output_dir: str) -> List[str]:
    """
    List all files in user's temporary directory.
    
    Args:
        user_email: User's email address
        base_output_dir: Base output directory path
        
    Returns:
        List[str]: List of file paths in user's temp directory
    """
    try:
        user_temp_dir = get_user_temp_dir(user_email, base_output_dir)
        if os.path.exists(user_temp_dir):
            files = []
            for item in os.listdir(user_temp_dir):
                item_path = os.path.join(user_temp_dir, item)
                if os.path.isfile(item_path):
                    files.append(item_path)
            return files
        return []
    except Exception as e:
        logging.error(f"Error listing user temp files for {user_email}: {e}")
        return []

def cleanup_user_temp_files(user_email: str, base_output_dir: str, file_patterns: Optional[List[str]] = None) -> int:
    """
    Clean up specific files in user's temporary directory.
    
    Args:
        user_email: User's email address
        base_output_dir: Base output directory path
        file_patterns: Optional list of file patterns to match (e.g., ['*.pdf', '*.txt'])
        
    Returns:
        int: Number of files cleaned up
    """
    try:
        user_temp_dir = get_user_temp_dir(user_email, base_output_dir)
        cleaned_count = 0
        
        if not os.path.exists(user_temp_dir):
            return 0
            
        for item in os.listdir(user_temp_dir):
            item_path = os.path.join(user_temp_dir, item)
            if os.path.isfile(item_path):
                # Check if file matches any pattern
                should_clean = True
                if file_patterns:
                    should_clean = any(item.endswith(pattern.replace('*', '')) for pattern in file_patterns)
                
                if should_clean:
                    try:
                        os.remove(item_path)
                        cleaned_count += 1
                        logging.info(f"Cleaned up user temp file: {item_path}")
                    except Exception as e:
                        logging.error(f"Error cleaning up user temp file {item_path}: {e}")
        
        return cleaned_count
        
    except Exception as e:
        logging.error(f"Error during user temp files cleanup for {user_email}: {e}")
        return 0


