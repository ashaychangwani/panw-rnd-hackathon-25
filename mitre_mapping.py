MITRE_DB = {
    "https": {"tactic": "Exfiltration", "technique": "Exfiltration Over HTTPS"},
    "dns": {"tactic": "Command and Control", "technique": "DNS Tunneling"},
    "failed login": {"tactic": "Initial Access", "technique": "Brute Force"},
}

def map_to_mitre(events):
    mapping = []
    for ev in events:
        low = ev["event"].lower()
        for k, v in MITRE_DB.items():
            if k in low:
                mapping.append({"event": ev["event"], **v})
    return mapping
