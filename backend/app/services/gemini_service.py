import google.generativeai as genai
from typing import Dict, Any, List
import json
import logging
from app.core.config import settings
from app.models.threat_analysis import ImplementationPlan, IoC

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        # Use gcloud default authentication
        genai.configure()
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def analyze_threat_blog(self, blog_content: str) -> ImplementationPlan:
        """
        Analyze blog content and extract structured threat intelligence.
        Uses function calling to ensure structured output.
        """
        
        # Define the function schema for structured output
        threat_analysis_schema = {
            "type": "object",
            "properties": {
                "hypothesis": {
                    "type": "string",
                    "description": "A detailed hypothesis about the threat based on the blog content"
                },
                "iocs_and_ttps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "indicator": {
                                "type": "string",
                                "description": "The specific indicator or TTP name"
                            },
                            "type": {
                                "type": "string",
                                "enum": ["IOC", "TTP"],
                                "description": "Whether this is an Indicator of Compromise or Tactic/Technique/Procedure"
                            },
                            "search_description": {
                                "type": "string",
                                "description": "Detailed description of how to search for this indicator"
                            },
                            "priority": {
                                "type": "string",
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
        
        # Define the function for structured extraction
        extract_threat_intel = genai.protos.FunctionDeclaration(
            name="extract_threat_intelligence",
            description="Extract structured threat intelligence from security blog content",
            parameters=threat_analysis_schema
        )
        
        # Create the tool
        threat_tool = genai.protos.Tool(function_declarations=[extract_threat_intel])
        
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
            # Generate response with function calling
            response = self.model.generate_content(
                prompt,
                tools=[threat_tool],
                tool_config={'function_calling_config': {'mode': 'ANY'}}
            )
            
            # Extract the function call result
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.function_call and part.function_call.name == "extract_threat_intelligence":
                        result_data = dict(part.function_call.args)
                        
                        # Convert to Pydantic models
                        iocs = [IoC(**ioc) for ioc in result_data.get("iocs_and_ttps", [])]
                        
                        return ImplementationPlan(
                            hypothesis=result_data.get("hypothesis", ""),
                            iocs_and_ttps=iocs
                        )
            
            # Fallback if function calling fails
            logger.warning("Function calling failed, attempting text parsing")
            return self._parse_text_response(response.text)
            
        except Exception as e:
            logger.error(f"Error in Gemini analysis: {str(e)}")
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