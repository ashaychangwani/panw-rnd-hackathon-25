import warnings
from google import genai
from google.genai import types
from typing import Dict, Any, List
import json
import logging
from app.core.config import settings
from app.models.threat_analysis import ImplementationPlan, IoC

# Suppress pydantic field shadowing warnings from Google genai library
warnings.filterwarnings("ignore", message="Field name .* shadows an attribute in parent", category=UserWarning)

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        # Use gcloud default authentication for Vertex AI
        self.client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location
        )
    
    def analyze_threat_blog(self, blog_content: str) -> ImplementationPlan:
        """
        Analyze blog content and extract structured threat intelligence.
        Uses function calling to ensure structured output.
        """
        
        # Define the function schema for structured output using the new SDK
        threat_analysis_schema = {
            "type": "OBJECT",
            "properties": {
                "hypothesis": {
                    "type": "STRING",
                    "description": "A detailed hypothesis about the threat based on the blog content"
                },
                "iocs_and_ttps": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "indicator": {
                                "type": "STRING",
                                "description": "The specific indicator or TTP name"
                            },
                            "type": {
                                "type": "STRING",
                                "enum": ["IOC", "TTP"],
                                "description": "Whether this is an Indicator of Compromise or Tactic/Technique/Procedure"
                            },
                            "search_description": {
                                "type": "STRING",
                                "description": "Detailed description of how to search for this indicator"
                            },
                            "priority": {
                                "type": "STRING",
                                "enum": ["high", "medium", "low"],
                                "description": "Priority level for this indicator"
                            }
                        },
                        "required": ["indicator", "type", "search_description", "priority"]
                    }
                }
            },
            "required": ["hypothesis", "iocs_and_ttps"]
        }
        
        # Define the function for structured extraction using new SDK
        extract_threat_intel = {
            "name": "extract_threat_intelligence",
            "description": "Extract structured threat intelligence from security blog content",
            "parameters": threat_analysis_schema
        }
        
        # Create the tool using new SDK
        threat_tool = types.Tool(function_declarations=[extract_threat_intel])
        
        # Craft the prompt
        prompt = f"""
        You are a cybersecurity threat intelligence analyst. Analyze the following security blog content and extract:

        1. A detailed hypothesis about the threat described
        2. Specific Indicators of Compromise (IOCs) and Tactics, Techniques, and Procedures (TTPs)

        For each indicator/TTP, provide:
        - The specific indicator name
        - Whether it's an IOC or TTP
        - Detailed search instructions for threat hunters
        - Priority level (high/medium/low)

        Focus on actionable intelligence that can be used to hunt for this threat across enterprise environments.

        Blog Content:
        {blog_content[:8000]}  # Limit content to avoid token limits
        
        Extract the threat intelligence using the provided function.
        """
        
        try:
            logger.info("Sending request to Gemini API for threat analysis")
            
            # Generate response with function calling using new SDK
            response = self.client.models.generate_content(
                model='gemini-2.5-pro',
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[threat_tool],
                    http_options=types.HttpOptions(extra_body={'tool_config': {'function_calling_config': {'mode': 'COMPOSITIONAL'}}}),
                )
            )
            
            logger.info("Received response from Gemini API")
            
            # Validate response structure
            if not response:
                logger.error("Gemini API returned None response")
                return self._get_fallback_plan(blog_content)
                
            if not response.candidates:
                logger.error("Gemini API response has no candidates")
                return self._get_fallback_plan(blog_content)
                
            if not response.candidates[0].content.parts:
                logger.error("Gemini API response candidate has no content parts")
                return self._get_fallback_plan(blog_content)
            
            # Extract the function call result
            logger.info(f"Processing {len(response.candidates[0].content.parts)} response parts")
            
            for i, part in enumerate(response.candidates[0].content.parts):
                logger.debug(f"Processing part {i}: has function_call={hasattr(part, 'function_call')}")
                
                if hasattr(part, 'function_call') and part.function_call and part.function_call.name == "extract_threat_intelligence":
                    logger.info("Found threat intelligence function call in response")
                    
                    try:
                        result_data = dict(part.function_call.args)
                        logger.info(f"Extracted function call data with keys: {list(result_data.keys())}")
                        
                        # Validate required fields
                        if "iocs_and_ttps" not in result_data:
                            logger.error("Function call result missing 'iocs_and_ttps' field")
                            continue
                            
                        # Convert to Pydantic models
                        iocs_data = result_data.get("iocs_and_ttps", [])
                        logger.info(f"Converting {len(iocs_data)} IoCs to Pydantic models")
                        
                        iocs = []
                        for j, ioc_data in enumerate(iocs_data):
                            try:
                                ioc = IoC(**ioc_data)
                                iocs.append(ioc)
                                logger.debug(f"Successfully converted IoC {j}: {ioc.indicator}")
                            except Exception as ioc_error:
                                logger.error(f"Failed to convert IoC {j} to Pydantic model: {str(ioc_error)}")
                                logger.error(f"IoC data: {ioc_data}")
                        
                        plan = ImplementationPlan(
                            hypothesis=result_data.get("hypothesis", ""),
                            iocs_and_ttps=iocs
                        )
                        
                        logger.info(f"Successfully created ImplementationPlan with {len(iocs)} IoCs")
                        return plan
                        
                    except Exception as parse_error:
                        logger.error(f"Error parsing function call result: {str(parse_error)}")
                        logger.error(f"Function call args: {part.function_call.args}")
                        continue
            
            # Fallback if function calling fails
            logger.warning("No valid function call found, attempting text parsing")
            if hasattr(response, 'text') and response.text:
                return self._parse_text_response(response.text)
            else:
                logger.error("Response has no text content for fallback parsing")
                return self._get_fallback_plan(blog_content)
            
        except Exception as e:
            logger.error(f"Critical error in Gemini analysis: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Return a basic fallback response
            return self._get_fallback_plan(blog_content)
    
    def _parse_text_response(self, text_response: str) -> ImplementationPlan:
        """Fallback text parsing if function calling fails"""
        try:
            # Try to extract JSON from the response
            start_idx = text_response.find('{')
            end_idx = text_response.rfind('}') + 1
            
            if start_idx != -1 and end_idx != -1:
                json_str = text_response[start_idx:end_idx]
                data = json.loads(json_str)
                
                iocs = [IoC(**ioc) for ioc in data.get("iocs_and_ttps", [])]
                return ImplementationPlan(
                    hypothesis=data.get("hypothesis", ""),
                    iocs_and_ttps=iocs
                )
        except Exception as e:
            logger.error(f"Failed to parse text response: {str(e)}")
        
        return self._get_fallback_plan(text_response)
    
    def _get_fallback_plan(self, content: str) -> ImplementationPlan:
        """Provide a basic fallback implementation plan"""
        return ImplementationPlan(
            hypothesis="Analysis of security blog content indicates potential threat activity requiring investigation across endpoint and network infrastructure.",
            iocs_and_ttps=[
                IoC(
                    indicator="Suspicious Network Connections",
                    type="TTP",
                    search_description="Monitor for unusual outbound network connections to external domains and IP addresses",
                    priority="medium"
                ),
                IoC(
                    indicator="File System Artifacts",
                    type="IOC",
                    search_description="Search for suspicious files, executables, or configuration changes mentioned in the blog",
                    priority="medium"
                ),
                IoC(
                    indicator="Process Execution Patterns",
                    type="TTP",
                    search_description="Look for unusual process execution, command line parameters, or system behavior",
                    priority="medium"
                )
            ]
        )
    
    def generate_workflow_steps(self, implementation_plan: ImplementationPlan) -> List[Dict[str, Any]]:
        """Generate workflow steps based on the implementation plan"""
        steps = []
        
        # Basic workflow template
        step_templates = [
            {
                "name": "Blog Content Analysis",
                "description": f"Analyze threat intelligence from blog source: {implementation_plan.hypothesis[:100]}...",
                "task_type": "blog_analysis",
                "dependencies": [],
                "estimated_duration": 30
            },
            {
                "name": "IoC Extraction Complete",
                "description": f"Extracted {len(implementation_plan.iocs_and_ttps)} indicators and TTPs for investigation",
                "task_type": "ioc_extraction",
                "dependencies": [],
                "estimated_duration": 60
            }
        ]
        
        # Generate steps for each high-priority IoC/TTP
        high_priority_items = [item for item in implementation_plan.iocs_and_ttps if item.priority == "high"]
        
        for i, item in enumerate(high_priority_items[:5]):  # Limit to 5 high priority items
            step_templates.append({
                "name": f"Investigate: {item.indicator}",
                "description": item.search_description,
                "task_type": f"ioc_investigation_{item.type.lower()}",
                "dependencies": ["ioc_extraction"],
                "estimated_duration": 120,
                "target_indicator": item.indicator,
                "search_description": item.search_description,
                "priority": item.priority
            })
        
        # Add correlation step
        if high_priority_items:
            step_templates.append({
                "name": "Evidence Correlation",
                "description": "Correlate findings across all edge nodes and analyze threat patterns",
                "task_type": "evidence_correlation",
                "dependencies": [f"ioc_investigation_{item.type.lower()}" for item in high_priority_items[:5]],
                "estimated_duration": 90
            })
        
        return step_templates