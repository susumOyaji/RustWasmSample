#!/usr/bin/env python3
"""
Simple HTTP server to serve the Rust WebAssembly application.
This server serves static files and handles CORS headers needed for WASM modules.
"""

import http.server
import socketserver
import os
import sys
import json
import requests
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS support for WebAssembly modules."""
    
    def end_headers(self):
        """Add CORS headers to all responses."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()
    
    def guess_type(self, path):
        """Override to set correct MIME types for WebAssembly files."""
        result = super().guess_type(path)
        
        # Handle different return formats from guess_type
        if isinstance(result, tuple) and len(result) >= 2:
            mimetype, encoding = result[0], result[1]
        else:
            mimetype, encoding = result, None
        
        # Convert path to string if it's a PathLike object
        path_str = str(path)
        
        # Set correct MIME type for WebAssembly files
        if path_str.endswith('.wasm'):
            mimetype = 'application/wasm'
        elif path_str.endswith('.js'):
            mimetype = 'application/javascript'
        elif path_str.endswith('.mjs'):
            mimetype = 'application/javascript'
            
        return mimetype
    
    def do_GET(self):
        """Handle GET requests including API proxy endpoints."""
        parsed_path = urlparse(self.path)
        
        # Handle Yahoo proxy API endpoints
        if parsed_path.path == '/api/proxy/yahoo':
            self.handle_yahoo_proxy()
        elif parsed_path.path == '/api/proxy/yahoo/news':
            self.handle_yahoo_news_proxy()
        elif parsed_path.path == '/api/status':
            self.handle_status()
        else:
            # Handle static files
            super().do_GET()
    
    def handle_yahoo_proxy(self):
        """Fetch Yahoo homepage content."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get('https://www.yahoo.com', headers=headers, timeout=10)
            response.raise_for_status()
            
            # Extract main content
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove scripts and problematic elements
            for script in soup.find_all(['script', 'iframe']):
                script.decompose()
            
            # Get simplified content
            content = str(soup)[:10000]  # Limit content size
            
            result = {
                'success': True,
                'content': f'<div style="padding: 20px;"><h2>Yahoo Homepage Content</h2><p>Content loaded successfully from Yahoo.com</p><div style="border: 1px solid #ddd; padding: 10px; max-height: 400px; overflow-y: auto; font-size: 12px;">{content}</div></div>',
                'title': 'Yahoo Homepage',
                'url': 'https://www.yahoo.com'
            }
            
            self.send_json_response(result)
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': f'Failed to fetch Yahoo content: {str(e)}',
                'content': '<div style="padding: 20px; text-align: center;"><h2>Unable to load Yahoo content</h2><p>The proxy server could not fetch the Yahoo homepage.</p></div>'
            }
            self.send_json_response(error_result, 500)
    
    def handle_yahoo_news_proxy(self):
        """Fetch Yahoo News content."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get('https://news.yahoo.com', headers=headers, timeout=10)
            response.raise_for_status()
            
            # Simple news extraction
            articles = [
                {'title': 'Yahoo News Article 1', 'url': 'https://news.yahoo.com/article1'},
                {'title': 'Yahoo News Article 2', 'url': 'https://news.yahoo.com/article2'},
                {'title': 'Yahoo News Article 3', 'url': 'https://news.yahoo.com/article3'},
                {'title': 'Sample Technology News', 'url': 'https://news.yahoo.com/tech'},
                {'title': 'Sample Sports Update', 'url': 'https://news.yahoo.com/sports'},
            ]
            
            result = {
                'success': True,
                'articles': articles,
                'source': 'Yahoo News'
            }
            
            self.send_json_response(result)
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': f'Failed to fetch Yahoo News: {str(e)}',
                'articles': []
            }
            self.send_json_response(error_result, 500)
    
    def handle_status(self):
        """API status endpoint."""
        result = {
            'status': 'running',
            'service': 'Yahoo Proxy Server',
            'endpoints': [
                '/api/proxy/yahoo - Yahoo homepage',
                '/api/proxy/yahoo/news - Yahoo news articles',
                '/api/status - This status endpoint'
            ]
        }
        self.send_json_response(result)
    
    def send_json_response(self, data, status_code=200):
        """Send JSON response."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        """Handle preflight requests."""
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        """Log server requests with timestamps."""
        print(f"[{self.log_date_time_string()}] {format % args}")

def serve_application(port=5000, directory="."):
    """Start the HTTP server for the Rust WebAssembly application."""
    
    # Change to the specified directory
    os.chdir(directory)
    
    # Create the server
    handler = CORSRequestHandler
    
    # Allow socket reuse to avoid "Address already in use" errors
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
        print("=" * 60)
        print("🦀 Rust WebAssembly Development Server")
        print("=" * 60)
        print(f"📂 Serving directory: {os.getcwd()}")
        print(f"🌐 Server running at: http://localhost:{port}")
        print(f"🔗 Access your app at: http://localhost:{port}")
        print()
        print("📋 Build Instructions:")
        print("   To compile Rust to WebAssembly, run:")
        print("   $ wasm-pack build --target web --out-dir pkg")
        print()
        print("📁 Expected file structure:")
        print("   ./pkg/hello_wasm.js")  
        print("   ./pkg/hello_wasm_bg.wasm")
        print()
        print("🛑 Press Ctrl+C to stop the server")
        print("=" * 60)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped by user")
            sys.exit(0)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Serve Rust WebAssembly application")
    parser.add_argument("--port", "-p", type=int, default=5000, 
                       help="Port to serve on (default: 5000)")
    parser.add_argument("--directory", "-d", default=".", 
                       help="Directory to serve (default: current directory)")
    
    args = parser.parse_args()
    
    # Check if we're in the right directory
    if not os.path.exists("index.html"):
        print("❌ Error: index.html not found in current directory")
        print("   Make sure you're running this from the project root")
        sys.exit(1)
    
    serve_application(args.port, args.directory)
