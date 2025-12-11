"""
MD5 Fix for ReportLab compatibility
Patches hashlib.md5 to remove usedforsecurity parameter
"""
import hashlib
import warnings

# Store original md5 function
original_md5 = hashlib.md5

# Create patched md5 function that ignores usedforsecurity
def patched_md5(*args, **kwargs):
    # Remove usedforsecurity if present
    if 'usedforsecurity' in kwargs:
        kwargs.pop('usedforsecurity')
        warnings.warn("MD5 usedforsecurity parameter removed for compatibility", DeprecationWarning)
    return original_md5(*args, **kwargs)

# Apply patch
hashlib.md5 = patched_md5

# Also patch openssl_md5 if it exists
if hasattr(hashlib, 'openssl_md5'):
    original_openssl_md5 = hashlib.openssl_md5
    def patched_openssl_md5(*args, **kwargs):
        if 'usedforsecurity' in kwargs:
            kwargs.pop('usedforsecurity')
            warnings.warn("OpenSSL MD5 usedforsecurity parameter removed for compatibility", DeprecationWarning)
        return original_openssl_md5(*args, **kwargs)
    hashlib.openssl_md5 = patched_openssl_md5
