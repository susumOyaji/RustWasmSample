#!/usr/bin/env python3
"""
Proxy server to fetch Yahoo homepage content and serve it to the WebAssembly application.
"""

from flask import Flask, jsonify, render_template_string, request
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
import urllib.parse

app = Flask(__name__)
CORS(app)

def clean_html_content(html):
    """Clean and process HTML content for embedding."""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove scripts for security
    for script in soup.find_all('script'):
        script.decompose()
    
    # Remove iframes that might cause issues
    for iframe in soup.find_all('iframe'):
        iframe.decompose()
    
    # Update relative URLs to absolute URLs
    base_url = 'https://www.yahoo.com'
    
    # Fix image sources
    for img in soup.find_all('img'):
        src = img.get('src')
        if src and src.startswith('/'):
            img['src'] = base_url + src
        elif src and src.startswith('//'):
            img['src'] = 'https:' + src
    
    # Fix link hrefs
    for link in soup.find_all('a'):
        href = link.get('href')
        if href and href.startswith('/'):
            link['href'] = base_url + href
        elif href and href.startswith('//'):
            link['href'] = 'https:' + href
    
    # Fix CSS links
    for link in soup.find_all('link', rel='stylesheet'):
        href = link.get('href')
        if href and href.startswith('/'):
            link['href'] = base_url + href
        elif href and href.startswith('//'):
            link['href'] = 'https:' + href
    
    return str(soup)

@app.route('/api/proxy/yahoo')
def proxy_yahoo():
    """Fetch Yahoo homepage content."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get('https://www.yahoo.com', headers=headers, timeout=10)
        response.raise_for_status()
        
        # Clean and process the HTML
        cleaned_html = clean_html_content(response.text)
        
        return jsonify({
            'success': True,
            'content': cleaned_html,
            'title': 'Yahoo Homepage',
            'url': 'https://www.yahoo.com'
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Failed to fetch Yahoo content: {str(e)}',
            'content': '<div style="padding: 20px; text-align: center;"><h2>Unable to load Yahoo content</h2><p>The proxy server could not fetch the Yahoo homepage.</p></div>'
        }), 500

@app.route('/api/proxy/yahoo/news')
def proxy_yahoo_news():
    """Fetch Yahoo News content."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get('https://news.yahoo.com', headers=headers, timeout=10)
        response.raise_for_status()
        
        # Extract news articles using BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find news articles (this is a simplified extraction)
        articles = []
        news_items = soup.find_all(['h3', 'h2'], limit=10)
        
        for item in news_items:
            link = item.find('a')
            if link:
                title = link.get_text(strip=True)
                href = link.get('href', '')
                if href.startswith('/'):
                    href = 'https://news.yahoo.com' + href
                elif href.startswith('//'):
                    href = 'https:' + href
                
                if title and len(title) > 10:  # Filter out short/empty titles
                    articles.append({
                        'title': title,
                        'url': href
                    })
        
        return jsonify({
            'success': True,
            'articles': articles[:8],  # Limit to 8 articles
            'source': 'Yahoo News'
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Failed to fetch Yahoo News: {str(e)}',
            'articles': []
        }), 500

@app.route('/api/status')
def api_status():
    """API status endpoint."""
    return jsonify({
        'status': 'running',
        'service': 'Yahoo Proxy Server',
        'endpoints': [
            '/api/proxy/yahoo - Yahoo homepage',
            '/api/proxy/yahoo/news - Yahoo news articles',
            '/api/status - This status endpoint'
        ]
    })

if __name__ == '__main__':
    print("Starting Yahoo Proxy Server...")
    print("Available endpoints:")
    print("  - http://localhost:5002/api/proxy/yahoo")
    print("  - http://localhost:5002/api/proxy/yahoo/news")
    print("  - http://localhost:5002/api/status")
    
    app.run(host='0.0.0.0', port=5002, debug=False)