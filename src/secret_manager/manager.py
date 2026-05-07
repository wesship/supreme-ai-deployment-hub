"""
Secrets Manager for API keys
"""
import os
import sys
from typing import Dict, Optional
import json
from cryptography.fernet import Fernet
import base64

# In-memory cache of decrypted keys
_api_keys_cache: Dict[str, str] = {}

# Path to encrypted keys storage
KEYS_FILE = os.environ.get("KEYS_FILE", "secrets/encrypted_keys.json")

# Encryption key must be provided via the ENCRYPTION_KEY environment variable.
# No hardcoded fallback is intentional — a missing key in production is a
# configuration error that must be caught at startup.
_ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")

# Support both NODE_ENV (Node.js convention used across this project) and
# ENVIRONMENT / APP_ENV (common Python / cloud-platform conventions).
_ENV = (
    os.environ.get("ENVIRONMENT")
    or os.environ.get("APP_ENV")
    or os.environ.get("NODE_ENV")
    or ""
).lower()
_IS_PRODUCTION = _ENV == "production"

if _IS_PRODUCTION and not _ENCRYPTION_KEY:
    raise EnvironmentError(
        "ENCRYPTION_KEY environment variable is required in production but was not set. "
        "Set it to a valid Fernet key before starting the application."
    )

if not _IS_PRODUCTION and not _ENCRYPTION_KEY:
    # Warn loudly in development/test so this isn't missed.
    print(
        "WARNING: ENCRYPTION_KEY is not set. "
        "Encrypted storage will be unavailable. "
        "Set ENCRYPTION_KEY to enable it.",
        file=sys.stderr,
    )


def _get_cipher():
    """Get the encryption cipher, or return None if no key is configured."""
    if not _ENCRYPTION_KEY:
        return None
    try:
        key = base64.urlsafe_b64decode(_ENCRYPTION_KEY)
        return Fernet(key)
    except Exception as e:
        print(f"Error initializing cipher: {e}")
        return None

def _load_encrypted_keys() -> Dict[str, str]:
    """Load encrypted keys from file"""
    try:
        if not os.path.exists(KEYS_FILE):
            return {}
            
        with open(KEYS_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading keys: {e}")
        return {}

def _save_encrypted_keys(keys: Dict[str, str]) -> bool:
    """Save encrypted keys to file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(KEYS_FILE), exist_ok=True)
        
        with open(KEYS_FILE, "w") as f:
            json.dump(keys, f)
        return True
    except Exception as e:
        print(f"Error saving keys: {e}")
        return False

def get_api_key(key_name: str) -> Optional[str]:
    """
    Get an API key by name, checking:
    1. In-memory cache
    2. Environment variables
    3. Encrypted storage
    """
    # Check cache first for performance
    if key_name in _api_keys_cache:
        return _api_keys_cache[key_name]
    
    # Check environment variables (useful for container deployments)
    if key_name in os.environ:
        _api_keys_cache[key_name] = os.environ[key_name]
        return _api_keys_cache[key_name]
    
    # Check encrypted storage
    cipher = _get_cipher()
    if not cipher:
        return None
        
    encrypted_keys = _load_encrypted_keys()
    if key_name in encrypted_keys:
        try:
            decrypted_key = cipher.decrypt(encrypted_keys[key_name].encode()).decode()
            _api_keys_cache[key_name] = decrypted_key
            return decrypted_key
        except Exception as e:
            print(f"Error decrypting key {key_name}: {e}")
            
    return None

def set_api_key(key_name: str, api_key: str) -> bool:
    """
    Store an API key securely:
    1. Update in-memory cache
    2. Encrypt and store in file
    """
    cipher = _get_cipher()
    if not cipher:
        return False
    
    try:
        # Update cache
        _api_keys_cache[key_name] = api_key
        
        # Encrypt and save
        encrypted_keys = _load_encrypted_keys()
        encrypted_keys[key_name] = cipher.encrypt(api_key.encode()).decode()
        
        return _save_encrypted_keys(encrypted_keys)
    except Exception as e:
        print(f"Error setting key {key_name}: {e}")
        return False

def delete_api_key(key_name: str) -> bool:
    """Delete an API key"""
    # Remove from cache
    if key_name in _api_keys_cache:
        del _api_keys_cache[key_name]
    
    # Remove from storage
    encrypted_keys = _load_encrypted_keys()
    if key_name in encrypted_keys:
        del encrypted_keys[key_name]
        return _save_encrypted_keys(encrypted_keys)
    
    return True  # Key wasn't in storage anyway

def list_available_keys() -> list[str]:
    """List all available key names (without exposing values)"""
    keys = set()
    
    # Get from environment
    for key in os.environ:
        if key.endswith('_API_KEY'):
            keys.add(key)
    
    # Get from encrypted storage
    encrypted_keys = _load_encrypted_keys()
    for key in encrypted_keys:
        keys.add(key)
    
    return sorted(list(keys))
