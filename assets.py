import re

def extract_assets(events):
    ip_pattern = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')
    host_pattern = re.compile(r'host[:=]([A-Za-z0-9\-_\.]+)', re.IGNORECASE)
    user_pattern = re.compile(r'user[:=]([A-Za-z0-9\-_\.]+)', re.IGNORECASE)

    assets = {"ips": set(), "hosts": set(), "users": set()}

    for ev in events:
        line = ev["event"]
        assets["ips"].update(ip_pattern.findall(line))
        assets["hosts"].update(host_pattern.findall(line))
        assets["users"].update(user_pattern.findall(line))

    return {k: list(v) for k,v in assets.items()}
