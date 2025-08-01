from vertexai.generative_models import GenerativeModel, Part, FinishReason, HarmCategory, HarmBlockThreshold, SafetySetting
from google import genai
from google.genai import types
import pyshark

from llm import GeminiLLM, extract_json_obj
import json
import logging
from typing import Dict, Any
import os
logger = logging.getLogger(__name__)
import time

tasks = {
  "hypothesis": "Unpatched Apache Log4j 2 instances (CVE-2021-44228, CVE-2021-45046, CVE-2021-45105, CVE-2021-44832) within our environment may have been exploited, resulting in remote code execution and the deployment of post-exploitation tools such as information stealers, CobaltStrike beacons, or coinminers.",
  "iocs_and_ttps": [
    {
      "indicator": "JNDI Lookup Strings in HTTP Requests",
      "type": "TTP",
      "search_description": "Look for HTTP requests (GET/POST) containing JNDI lookup patterns like '${jndi:ldap://', '${jndi:rmi://', or similar, especially in URL paths, User-Agent, Referer, X-Api-Version, Accept-Language, or Cookie headers. Also search for base64 encoded strings that decode to such patterns.",
      "priority": "high"
    },
    {
      "indicator": "Outbound LDAP/RMI Connections",
      "type": "TTP",
      "search_description": "Monitor for outbound LDAP (TCP/389, 636) or RMI (TCP/1099) connections originating from internal servers, particularly those running Java applications, to external or unusual internal IP addresses.",
      "priority": "high"
    },
    {
      "indicator": "Malicious Callback/C2 Domains & IPs",
      "type": "IOC",
      "search_description": "Look for outbound network connections (HTTP/S, LDAP, RMI, raw sockets) to the following known malicious domains and IP addresses: 1ma[.]xyz (and subdomains like *.pef.mur.1ma.xyz, spif.mur.1ma.xyz), 139.155.2[.]105, 192.46.216[.]224, 161.35.184[.]54, 165.22.2[.]186, 150.60.139[.]51, 68.183.165[.]105, 2.57.121[.]36, 45.83.64[.]1, 195.54.160[.]149, 45.83.193[.]150, 64.39.98[.]200, 193.3.19[.]159, 5.101.118[.]127, 31.131.16[.]127, 45.66.8[.]12, 185.246.87[.]50.",
      "priority": "high"
    },
    {
      "indicator": "Download and Execution of Remote Java Classes",
      "type": "TTP",
      "search_description": "Monitor for Java processes attempting to download and load '.class' files from remote HTTP/S servers (e.g., Rjava.class, V8.class, EvilObj.class, Exploit.class).",
      "priority": "high"
    },
    {
      "indicator": "Post-Exploitation Command Execution",
      "type": "TTP",
      "search_description": "Look for unusual process creation or command execution on Java application servers, including PowerShell commands downloading files from external URLs, 'curl.exe' or 'wget.exe' used for data exfiltration or payload download, and suspicious 'Java.lang.Runtime.exec' calls.",
      "priority": "high"
    },
    {
      "indicator": "CobaltStrike Beacon Activity",
      "type": "TTP",
      "search_description": "Search for outbound network connections to 139.155.2[.]105:4433, which is a known CobaltStrike C2 server, or other common CobaltStrike C2 patterns.",
      "priority": "medium"
    },
    {
      "indicator": "Data Exfiltration Attempts (V8 Stealer)",
      "type": "TTP",
      "search_description": "Look for outbound HTTP POST requests to '1ma[.]xyz' subdomains containing sensitive data (e.g., '/etc/passwd' content, environment variables) or DNS queries to '*.spif.mur.1ma.xyz' indicative of DNS tunneling.",
      "priority": "medium"
    },
    {
      "indicator": "XMRig Coinminer Artifacts",
      "type": "IOC",
      "search_description": "Search for the presence or execution of 'xmrig64.exe' or network connections related to the Monero wallet address '46QBumovWy4dLJ4R8wq8JwhHKWMhCaDyNDEzvxHFmAHn92EyKrttq6LfV6if5UYDAyCzh3egWXMhnfJJrEhWkMzqTPzGzsE'.",
      "priority": "medium"
    },
    {
      "indicator": "Internal Log4j Scanning Activity",
      "type": "TTP",
      "search_description": "Identify internal systems initiating Log4j exploitation attempts (JNDI lookups) against other internal systems, particularly targeting RFC1918 IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).",
      "priority": "medium"
    },
    {
      "indicator": "Vulnerable Log4j Versions",
      "type": "TTP",
      "search_description": "Identify systems running Apache Log4j 2.x versions <= 2.15.0-rc1 (for CVE-2021-44228), <= 2.16.0 (for CVE-2021-45046, CVE-2021-45105), or <= 2.17.0 (for CVE-2021-44832). This is a pre-exploitation indicator for asset identification.",
      "priority": "low"
    }
  ]
}

def describe_files(folder_dir: str, llm_model: GeminiLLM) -> Dict[str, Dict[str, Any]]:
    """
    Analyzes all files in a directory and generates a natural language description
    and a schema for each one using an LLM.

    Args:
        folder_dir: The path to the directory to scan.
        llm_model: An instance of the LLM class to use for generation.

    Returns:
        A dictionary where each key is a file's name and the value is another
        dictionary containing the file's description and schema.
    """
    if not os.path.isdir(folder_dir):
      logging.error(f"Directory not found: {folder_dir}")
      return {}

    file_descriptions = {} # Change to a dictionary to store results
    
    # Use a recursive walk to find all files in the directory and its subdirectories
    for root, _, files in os.walk(folder_dir):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            
            try:
              if file_name.endswith('.pcap') or file_name.endswith('.pcapng'):
                  logging.info(f"Analyzing PCAP file: {file_path}")
                  
                  # Use pyshark to read the first few packets
                  try:
                      cap = pyshark.FileCapture(file_path, only_summaries=False)
                      packets_preview = [str(packet) for i, packet in enumerate(cap) if i < 10]
                      cap.close()
                      
                      file_content_preview = "\n".join(packets_preview)
                      if not file_content_preview:
                          file_content_preview = "This PCAP file does not contain HTTP, LDAP, or RMI traffic in its initial packets."
                  except Exception as pcap_e:
                      logging.warning(f"Could not read PCAP file {file_name} with pyshark: {pcap_e}. Sending an empty preview to the LLM.")
                      file_content_preview = "This file appears to be a corrupted or empty PCAP file."
              else:
                # Read the first few lines of the file to provide context for the LLM
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_content_preview = "".join(f.readlines(50))
                
              logging.info(f"Analyzing file: {file_path}")
              
              prompt = (
                  f"Given the following file content, provide a natural language description of its purpose "
                  f"and a JSON schema that describes its structure. The content is a snippet from the file:\n"
                  f"```\n{file_content_preview}\n```\n"
                  f"Your response should be a JSON object with two keys: 'description' and 'schema'."
              )
              
              # Call the LLM to generate the description and schema
              llm_response = llm_model.api_call(prompt)
              print(llm_response)
              # Extract the JSON object from the LLM's response
              result = extract_json_obj(llm_response)

              if result:
                  # Store the result with the file_name as the key
                  file_descriptions[file_name] = {
                      "description": result.get("description", "N/A"),
                      "schema": result.get("schema", "N/A")
                  }
              else:
                  logging.warning(f"Could not parse LLM response for file: {file_name}")
                
            except Exception as e:
                logging.error(f"An error occurred while processing {file_name}: {e}")
                
    return file_descriptions

def save_json_to_file(data: Dict[str, Any], file_path: str):
    """
    Saves a Python dictionary to a file in JSON format.

    Args:
        data: The dictionary to be saved.
        file_path: The full path to the output JSON file.
    """
    try:
        # Open the file in write mode ('w') with UTF-8 encoding
        with open(file_path, 'w', encoding='utf-8') as f:
            # Use json.dump to write the dictionary to the file
            # indent=2 makes the JSON file human-readable
            json.dump(data, f, indent=2)
        logging.info(f"Successfully saved data to {file_path}")
    except IOError as e:
        logging.error(f"Error saving file to {file_path}: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")

import json

def load_json_from_file(file_path: str) -> dict | list:
    """
    Loads data from a JSON file.

    Args:
        file_path: The path to the JSON file.

    Returns:
        A Python dictionary or list representing the JSON data.
        Returns an empty dictionary if the file is not found or is empty.
        Raises a JSONDecodeError if the file content is not valid JSON.
    """
    try:
        # Open the file in read mode ('r') with UTF-8 encoding
        with open(file_path, 'r', encoding='utf-8') as f:
            # Use json.load to parse the file content into a Python object
            data = json.load(f)
            return data
    except FileNotFoundError:
        print(f"Error: The file at {file_path} was not found.")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error: Failed to decode JSON from {file_path}. Details: {e}")
        # Re-raise the exception or return a meaningful value
        raise
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {}


import subprocess
import sys

def run_code_string_with_subprocess(code_string):
    """
    Executes a string of Python code in a separate process and captures output and errors.
    
    Args:
        code_string (str): The Python code to execute.
    
    Returns:
        A tuple (stdout, stderr, exit_code).
    """
    try:
        # The '-c' flag tells the Python interpreter to run the code in the string.
        process = subprocess.run(
            [sys.executable, '-c', code_string],
            capture_output=True,
            text=True,
            check=False
        )
        return process.stdout, process.stderr, process.returncode
    except Exception as e:
        return "", str(e), -1

def run_code_string_with_retry(code_string: str, retries: int = 3, delay: int = 5):
    """
    Executes a string of Python code in a separate process, with retry logic.
    
    Args:
        code_string (str): The Python code to execute.
        retries (int): The maximum number of attempts.
        delay (int): The delay in seconds between retries.
    
    Returns:
        A tuple (stdout, stderr, exit_code).
    """
    for attempt in range(retries):
        try:
            logging.info(f"Attempt {attempt + 1}/{retries} to execute code.")
            process = subprocess.run(
                [sys.executable, '-c', code_string],
                capture_output=True,
                text=True,
                check=False
            )
            
            # Check for a successful execution (e.g., exit code 0)
            if process.returncode == 0:
                logging.info("Code executed successfully.")
                return process.stdout, process.stderr, process.returncode
            
            else:
                logging.warning(f"Code execution failed with exit code {process.returncode}. Stderr: {process.stderr}")
                if attempt < retries - 1:
                    logging.info(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    logging.error("Maximum retries exceeded. Giving up.")
                    return process.stdout, process.stderr, process.returncode
        
        except Exception as e:
            logging.error(f"An unexpected error occurred during execution attempt: {e}")
            if attempt < retries - 1:
                logging.info(f"Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                logging.error("Maximum retries exceeded. Giving up.")
                return "", str(e), -1
    
    return "", "Maximum retries exceeded without a successful run.", -1

def task_execution(task, file_dir='./example_data/log_files'):
  LLM = GeminiLLM()
  file_desc = describe_files(file_dir, LLM) 
  print('-'*100)
  save_json_to_file(file_desc, 'file_desc.json')

  file_desc = load_json_from_file('file_desc.json')

  successful_outputs = {}

  for task in tasks['iocs_and_ttps']:
      indicator = task['indicator']
      search_description = task['search_description']
      
      # Create a detailed prompt for the LLM

      prompt = (
          f"Hypothesis: {tasks['hypothesis']}\n\n"
          f"Indicator: {indicator}\n"
          f"Description: {search_description}\n\n"
          f"We have the following files available for analysis (which is in the folder: '{file_dir}'), along with their descriptions and schemas:\n"
          f"```json\n{json.dumps(file_desc, indent=2)}\n```\n\n"
          f"Given the above information, provide a detailed plan on how to use the available files to verify this indicator. "
          f"Your response should be a JSON object with the following keys: "
          f"'code_to_execute' (the code to be executed), "
          f"'code_language' (terminal_cmd/python), "
          f"'Note: this is how to open a pcap file: import pyshark cap = pyshark.FileCapture(file_path, only_summaries=False) packets_preview = [str(packet) for i, packet in enumerate(cap) if i < 10]cap.close() "
          f"'Note: if there is a encoded text/code try to decode it"

      )

      logging.info(f"Generating analysis plan for indicator: {indicator}")
      
      try:
          llm_response = LLM.api_call(prompt)
          analysis_plan = extract_json_obj(llm_response)
          
          if analysis_plan:
              if analysis_plan.get('code_language', 'None') == 'python':
                  py_code = analysis_plan.get('code_to_execute', 'None')
                  stdout, stderr, exit_code = run_code_string_with_retry(py_code, retries=5, delay=10)
                  
                  print("--- Code Execution Result ---")
                  print(f"Exit Code: {exit_code}")
                  print("Stdout:", stdout)
                  print("Stderr:", stderr)
                  
                  # Now, you can use the LLM to analyze the results and potentially suggest a fix.
                  if exit_code == 0:
                      logging.info(f"Successfully executed code for indicator: {indicator}")
                      successful_outputs[indicator] = stdout
                  if exit_code != 0:
                      # Prompt the LLM to fix the code
                      prompt_for_fix = (
                          f"The following Python code failed to execute. "
                          f"Please analyze the error and provide a corrected version of the code.\n\n"
                          f"Original Code:\n```python\n{py_code}\n```\n\n"
                          f"Error (Stderr):\n```\n{stderr}\n```\n\n"
                          f"Provide the corrected code in a JSON object with a single key 'code_to_execute'."
                      )
                      
                      logging.warning("Code execution failed. Requesting LLM to fix the code.")
                      fix_response = LLM.api_call(prompt_for_fix)
                      fix_plan = extract_json_obj(fix_response)
                      
                      if fix_plan and 'code_to_execute' in fix_plan:
                          corrected_code = fix_plan['code_to_execute']
                          logging.info("LLM provided a corrected code. Retrying with new code.")
                          
                          # You could add another layer of retry here for the corrected code
                          stdout, stderr, exit_code = run_code_string_with_retry(corrected_code, retries=2, delay=5)
                          
                          print("--- Retried Code Execution Result ---")
                          print(f"Exit Code: {exit_code}")
                          print("Stdout:", stdout)
                          print("Stderr:", stderr)
                          if exit_code == 0:
                              logging.info(f"Successfully executed corrected code for indicator: {indicator}")
                              successful_outputs[indicator] = stdout
                      else:
                          logging.error("LLM failed to provide a valid code fix.")
              elif analysis_plan.get('code_language', 'None') == 'terminal_cmd':
                    pass
              else:
                  logging.warning(f"Unsupported execution environment for indicator: {indicator}")
      
      except Exception as e:
          logging.error(f"An error occurred while getting the LLM response for indicator {indicator}: {e}")
  return successful_outputs


if __name__ == "__main__":
  task_results = task_execution(tasks, file_dir='./example_data/log_files')
  save_json_to_file(task_results, 'task_results.json')
