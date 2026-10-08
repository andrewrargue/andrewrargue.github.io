import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import http.server, socketserver
PORT = int(os.environ.get("PORT", 3900))
Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving on http://localhost:{PORT}")
    httpd.serve_forever()
