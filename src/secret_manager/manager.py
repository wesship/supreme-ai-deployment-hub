"""
Secrets Manager for API keys.

Runtime behavior:
1. Prefer environment variables for container/platform deployments.
2. Optionally use encrypted local storage when ENCRYPTION_KEY is explicitly configured.
3. Never use committed or hardcoded fallback secrets.
"""
import json
import os
from typing import Dict, Optional

from cryptography.fernet import Fernet

# In-memory cache of decrypted keys
_api_keys_cache: Dict[str, str] = {}

# Path to encrypted keys storage
KEYS_FILE = os.environ.get("KEYS_FILE", "secrets/encrypted_keys.json")


def _get_cipher() -> Optional[Fernet]:
    """Get the encryption cipher when ENCRYPTION_KEY is explicitly configured."""
    encryption_key = os.environ.get("ENCRYPTION_KEY")
    if not encryption_key:
        return None

    try:
        return Fernet(encryption_key.encode())
    except Exception as exc:
        print(f"Error initializing cipher: {exc}")
        return None


def _load_encrypted_keys() -> Dict[str, str]:
    """Load encrypted keys from file."""
    try:
        if not os.path.exists(KEYS_FILE):
            return {}

        with open(KEYS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        print(f"Error loading keys: {exc}")
        return {}


def _save_encrypted_keys(keys: Dict[str, str]) -> bool:
    """Save encrypted keys to file."""
    try:
        directory = os.path.dirname(KEYS_FILE)
        if directory:
            os.makedirs(directory, exist_ok=True)

        with open(KEYS_FILE, "w", encoding="utf-8") as f:
            json.dump(keys, f)
        return True
    except Exception as exc:
        print(f"Error saving keys: {exc}")
        return False


def get_api_key(key_name: str) -> Optional[str]:
    """
    Get an API key by name, checking:
    1. In-memory cache
    2. Environment variables
    3. Encrypted storage, only when ENCRYPTION_KEY is configured
    """
    if key_name in _api_keys_cache:
        return _api_keys_cache[key_name]

    if key_name in os.environ:
        _api_keys_cache[key_name] = os.environ[key_name]
        return _api_keys_cache[key_name]

    cipher = _get_cipher()
    if not cipher:
        return None

    encrypted_keys = _load_encrypted_keys()
    if key_name in encrypted_keys:
        try:
            decrypted_key = cipher.decrypt(encrypted_keys[key_name].encode()).decode()
            _api_keys_cache[key_name] = decrypted_key
            return decrypted_key
        except Exception as exc:
            print(f"Error decrypting key {key_name}: {exc}")

    return None


def set_api_key(key_name: str, api_key: str) -> bool:
    """
    Store an API key securely:
    1. Update in-memory cache
    2. Encrypt and store in file

    Requires ENCRYPTION_KEY to be configured. Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    """
    cipher = _get_cipher()
    if not cipher:
        print("ENCRYPTION_KEY is required to store encrypted API keys")
        return False

    try:
        _api_keys_cache[key_name] = api_key

        encrypted_keys = _load_encrypted_keys()
        encrypted_keys[key_name] = cipher.encrypt(api_key.encode()).decode()

        return _save_encrypted_keys(encrypted_keys)
    except Exception as exc:
        print(f"Error setting key {key_name}: {exc}")
        return False


def delete_api_key(key_name: str) -> bool:
    """Delete an API key."""
    if key_name in _api_keys_cache:
        del _api_keys_cache[key_name]

    encrypted_keys = _load_encrypted_keys()
    if key_name in encrypted_keys:
        del encrypted_keys[key_name]
        return _save_encrypted_keys(encrypted_keys)

    return True


def list_available_keys() -> list[str]:
    """List all available key names without exposing values."""
    keys = set()

    for key in os.environ:
        if key.endswith("_API_KEY"):
            keys.add(key)

    if os.environ.get("ENCRYPTION_KEY"):
        encrypted_keys = _load_encrypted_keys()
        for key in encrypted_keys:
            keys.add(key)

    return sorted(list(keys))
