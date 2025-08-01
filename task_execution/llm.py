from vertexai.generative_models import GenerativeModel, Part, FinishReason, HarmCategory, HarmBlockThreshold, SafetySetting
from google import genai
from google.genai import types
import json
import logging
logger = logging.getLogger(__name__)


class GeminiLLM():
    def __init__(self, project_id = 'panw-tdp-dev', location="global"):
        # Initialize with configurable parameters
        self.client = genai.Client(vertexai=True, project=project_id, location=location)
        self.model = "gemini-2.5-pro"
        self.max_output_tokens = 65535
        self.grounding_enabled = False
        self.safety_config = [
                    SafetySetting(
                        category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                        threshold=HarmBlockThreshold.BLOCK_NONE,
                    ),
                    SafetySetting(
                        category=HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold=HarmBlockThreshold.BLOCK_NONE,
                    ),
                    SafetySetting(
                        category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold=HarmBlockThreshold.BLOCK_NONE,
                    )
                ]
        
    def api_call(self, user_prompt: str, system_prompt=None):
        # Apply configuration  
        config_params = {
            "safety_settings": self.safety_config,
            "system_instruction": system_prompt or "You are helpful asistant for synthtic data generation",
            "max_output_tokens": self.max_output_tokens,
        }
        if self.grounding_enabled:
            config_params["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        response = self.client.models.generate_content(
                    model=self.model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(**config_params)
                    )
        if response.text is None:
            print(response)
        return response.text
    

def extract_json_obj(llm_message):
    try:
        start_index = llm_message.index('{')
        end_index = llm_message.rindex('}') + 1
        json_string = llm_message[start_index:end_index]
        llm_response = json.loads(json_string)
        return llm_response
    except Exception as e:
        logger.error(f'Error parsing JSON from message: {e}, llm_message: {llm_message}')
        return None