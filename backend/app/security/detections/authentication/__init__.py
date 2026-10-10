"""Authentication detection rules."""

from .brute_force import BruteForceDetection
from .credential_stuffing import CredentialStuffingDetection
from .impossible_travel import ImpossibleTravelDetection
from .token_anomaly import TokenAnomalyDetection
from .mfa_bypass import MFABypassDetection

from ..base import DETECTION_REGISTRY

# Auto-register all authentication rules
DETECTION_REGISTRY.register(BruteForceDetection())
DETECTION_REGISTRY.register(CredentialStuffingDetection())
DETECTION_REGISTRY.register(ImpossibleTravelDetection())
DETECTION_REGISTRY.register(TokenAnomalyDetection())
DETECTION_REGISTRY.register(MFABypassDetection())

__all__ = [
    "BruteForceDetection",
    "CredentialStuffingDetection",
    "ImpossibleTravelDetection",
    "TokenAnomalyDetection",
    "MFABypassDetection",
]
