import os, subprocess, re
from fastapi import FastAPI
from pydantic import BaseModel

LOG_DIR = "./logs"
PCAP_DIR = "./pcaps"

app = FastAPI()

class QueryRequest(BaseModel):
    query: str

@app.get("/list_logs")
def list_logs():
    return {
        "system_logs": [f for f in os.listdir(LOG_DIR) if f.endswith(".json")],
        "pcap_logs": [f for f in os.listdir(PCAP_DIR) if f.endswith(".pcap") or f.endswith(".pcapng")]
    }

# todo: pass llm commands, add system envioment to llm

@app.post("/query_logs")
def query_logs(req: QueryRequest):
    results = []
    for file in os.listdir(LOG_DIR):
        if file.endswith(".log"):
            path = os.path.join(LOG_DIR, file)
            out = subprocess.run(["grep", req.query, path], capture_output=True, text=True)
            for line in out.stdout.splitlines():
                ts = None
                m = re.search(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", line)
                if m: ts = m.group(0)
                results.append({"file": file, "timestamp": ts, "event": line})
    return {"results": results}

@app.post("/query_pcap")
def query_pcap(req: QueryRequest):
    results = []
    for file in os.listdir(PCAP_DIR):
        if file.endswith(".pcap"):
            path = os.path.join(PCAP_DIR, file)
            cmd = ["tshark", "-r", path, "-Y", req.query, "-T", "fields", "-e", "frame.time", "-e", "_ws.col.Info"]
            out = subprocess.run(cmd, capture_output=True, text=True)
            for line in out.stdout.splitlines():
                parts = line.split("\t", 1)
                if len(parts) == 2:
                    ts, info = parts
                    results.append({"file": file, "timestamp": ts.strip(), "event": info.strip()})
    return {"results": results}
