from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.request import urlopen
import os
import sys

REMOTE_BASE = "http://cademeupsi.com.br"

class ProxyHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy_request()
        else:
            super().do_GET()

    def proxy_request(self):
        target = f"{REMOTE_BASE}{self.path}"
        try:
            with urlopen(target) as resp:
                self.send_response(resp.status)
                content_type = resp.headers.get("Content-Type")
                if content_type:
                    self.send_header("Content-Type", content_type)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp.read())
        except Exception as exc:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"Proxy error: {exc}".encode("utf-8"))


def run(port: int = 4500):
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)
    server = HTTPServer(("", port), ProxyHandler)
    print(f"Serving {root} on http://localhost:{port}")
    print(f"Proxying /api/* -> {REMOTE_BASE}/api/*")
    server.serve_forever()


if __name__ == "__main__":
    port = 4500
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
