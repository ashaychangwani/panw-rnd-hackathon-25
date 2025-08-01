import os, getpass
import requests, json
from langchain.agents import initialize_agent, Tool
from langchain_community.llms import Ollama
from ioc_extraction import extract_iocs
from hunt import iterative_hunt
from timeline import draw_attack_chain
from langchain_google_genai import ChatGoogleGenerativeAI
from bs4 import BeautifulSoup
import sys
# GOOGLE_GENAI_USE_VERTEXAI = True
# GOOGLE_CLOUD_PROJECT_ID = "panw-tdp-dev"
# GOOGLE_CLOUD_LOCATION = "us-central1"  # e.g., "us-central1"

if "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = getpass.getpass("Enter your Google AI API key: ")

def browse_and_save_report(url: str, save_path: str) -> str:
    """
    Browses a URL, extracts the clean text content, and saves it to a local file.
    Returns the path to the saved file.
    """
    print(f"INFO: Browsing URL: {url}")
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        # Remove script and style elements for cleaner text
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()

        full_text = " ".join(soup.stripped_strings)

        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(full_text)

        print(f"INFO: Threat report content saved to: {save_path}")
        return f"Successfully saved report to {save_path}"

    except requests.RequestException as e:
        return f"Error: Could not browse URL. {e}"
    except Exception as e:
        return f"An unexpected error occurred: {e}"

def read_file_content(file_path: str) -> str:
    """
    Reads the text content of a local file and returns it as a string.
    """
    print(f"INFO: Reading content from file: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Truncate if too long to pass to the next step, as the full content is now stored locally
        # max_length = 15000
        # if len(content) > max_length:
        #     print(f"INFO: Content is long, truncating to {max_length} chars for LLM context.")
        #     return content[:max_length]
        return content
    except FileNotFoundError:
        return f"Error: File not found at path: {file_path}"
    except Exception as e:
        return f"Error reading file: {e}"

# MCP API wrappers
def list_logs():
    return requests.get("http://localhost:8000/list_logs").json()

def search_logs(query):
    return requests.post("http://localhost:8000/query_logs", json={"query": query}).json()

def search_pcap(filter_expr):
    return requests.post("http://localhost:8000/query_pcap", json={"query": filter_expr}).json()

# Tool wrapper for iterative hunting
def iterative_hunt_tool(iocs):
    report = iterative_hunt(
        iocs, search_logs, search_pcap, llm,
        report_path="hunt_report.json",
        html_path="hunt_report.html"
    )
    return {
        "message": "Hunt complete. Reports saved to hunt_report.json and hunt_report.html",
        "summary": report["final_results"]
    }

tools = [
    Tool(name="List Logs", func=list_logs, description="List all log files"),
    Tool(name="Iterative Hunt", func=iterative_hunt_tool,
         description="Perform iterative threat hunting with IOCs and pivoting")
]

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)

# === Example Threat Blog ===
blog_text = read_file_content('threat_report.txt')
print(f"Report content length: {len(blog_text)}")

# === 1. Extract IOCs ===
ioc_ttp_str = extract_iocs(llm, blog_text, 'blog_ioc_tpp.json')
full_ioc_ttp_json = json.loads(ioc_ttp_str)
print('initial_iocs', full_ioc_ttp_json)

sys.exit(1)
# === 2. Agent Task ===
task = f"""
We extracted these IOCs: {json.dumps(full_ioc_ttp_json, indent=2)}

Use Iterative Hunt to:
1. Start with these IOCs, search logs and PCAPs.
2. Pivot on new IOCs or assets discovered.
3. Continue hunting until no new leads are found.
4. Output:
   - Attack timeline
   - Affected assets
   - MITRE ATT&CK mapping
   - Suggested remediation.
"""

agent = initialize_agent(tools, llm, agent="zero-shot-react-description", verbose=True)
result = agent.run(task)

# === 3. Optional Visualization ===
hunt_results = iterative_hunt(full_ioc_ttp_json['iocs_and_ttps'], search_logs, search_pcap, llm)
if hunt_results["timeline"]:
    draw_attack_chain(hunt_results["timeline"])
