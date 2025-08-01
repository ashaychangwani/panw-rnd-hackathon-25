import json

def extract_iocs(llm, blog_text, save_path):
    prompt = f"""
        As a Senior Threat Intelligence Analyst, your task is to analyze the following threat report content and produce a structured threat hunting plan.
        Based on the text, generate a concise, actionable hypothesis for a threat hunt.
        Then, extract the most critical and searchable Indicators of Compromise (IOCs) and Tactics, Techniques, and Procedures (TTPs).

        Your final output MUST be a single, valid JSON object with two keys: "hypothesis" and "iocs_and_ttps".
        The "iocs_and_ttps" value must be a dictionary where keys are the TTP/IOC type and values are a brief description of what to search for.
        Rank these iocs_and_ttps indicators by likelihood of being primary signals for this threat. Consider uniqueness and relevance to the described attack.

        Example Output Format:
        {{
          "hypothesis": "The environment may be compromised by...",
          "iocs_and_ttps": [{{"indicator": "....", "type": "TTP/IOC", 
          "search_description": "Look for a ....","priority": "high"}}]
        }}

        Threat Report Content:
        ---
        {blog_text}
        ---

        Now, generate the JSON output.
        """
    res = llm.invoke(prompt)
    try:
        cleaned_response = str(res.content).strip().replace("```json", "").replace("```", "").strip()
        # Validate that the response is valid JSON before returning
        parsed_json = json.loads(cleaned_response)
        try:
            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(parsed_json, f, indent=2)
            print(f"INFO: Hypothesis and IOCs saved to {save_path}")
        except Exception as e:
            print(f"WARNING: Could not save hypothesis JSON to disk. Error: {e}")
        return cleaned_response
    except Exception as e:
        print(f"ERROR: LLM failed to generate valid JSON for hypothesis. Error: {e}")
        # Fallback to a default plan if the LLM fails
        fallback_plan = {
            "hypothesis": "Default Hypothesis: Possible Log4Shell exploitation leading to remote code execution.",
            "iocs_and_ttps": {"JNDI Exploit String": "Search for `${jndi:ldap` in logs."}
        }
        return json.dumps(fallback_plan)
