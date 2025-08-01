import httpx
from bs4 import BeautifulSoup
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class BlogService:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def fetch_blog_content(self, url: str) -> Optional[str]:
        """
        Fetch and extract clean text content from a blog URL.
        """
        try:
            logger.info(f"Fetching blog content from: {url}")
            response = await self.client.get(url)
            response.raise_for_status()
            
            # Parse HTML and extract clean text
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script_or_style in soup(["script", "style"]):
                script_or_style.decompose()
            
            # Extract main content - try common content selectors first
            content_selectors = [
                'article',
                '.post-content',
                '.entry-content', 
                '.content',
                'main',
                '.blog-post',
                '.post-body'
            ]
            
            content_text = ""
            for selector in content_selectors:
                content_element = soup.select_one(selector)
                if content_element:
                    content_text = " ".join(content_element.stripped_strings)
                    break
            
            # Fallback to body if no specific content found
            if not content_text:
                content_text = " ".join(soup.stripped_strings)
            
            logger.info(f"Extracted {len(content_text)} characters from blog")
            return content_text
            
        except Exception as e:
            logger.error(f"Error fetching blog content from {url}: {str(e)}")
            return None
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()