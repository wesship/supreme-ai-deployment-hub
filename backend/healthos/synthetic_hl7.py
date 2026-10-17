"""Synthetic HL7 v2 examples for the HealthOS hospital lab."""

ADT_A01_ADMISSION = (
    "MSH|^~\\&|ADT|SYNTHETIC-HOSPITAL|D3VONN|HEALTHOS|202609291200||ADT^A01|SYN-MSG-001|P|2.5\r"
    "PID|1||patient-001||Example^Jordan\r"
    "PV1|1|I|||||||||||||||||enc-001"
)

ADT_A03_DISCHARGE = (
    "MSH|^~\\&|ADT|SYNTHETIC-HOSPITAL|D3VONN|HEALTHOS|202609291800||ADT^A03|SYN-MSG-002|P|2.5\r"
    "PID|1||patient-001||Example^Jordan\r"
    "PV1|1|I|||||||||||||||||enc-001"
)
