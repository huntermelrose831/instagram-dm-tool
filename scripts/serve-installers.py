#!/usr/bin/env python3
"""
Quick HTTP server to serve installer files to Windows laptop
"""
import http.server
import socketserver
import os
import sys

# Change to the dist-electron directory
os.chdir('/home/hunterm/Desktop/projects/instagram-dm-tool/dist-electron')

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Only force download for .exe files, allow normal browsing for everything else
        if self.path.endswith('.exe'):
            self.send_header('Content-Disposition', 'attachment')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Log requests to show activity, handle variable args safely
        try:
            if len(args) >= 3:
                print(f"📥 Request: {args[0]} - {args[1]} - {args[2]}")
            elif len(args) >= 2:
                print(f"📥 Request: {args[0]} - {args[1]}")
            else:
                print(f"📥 Request: {format % args}")
        except Exception:
            # Fallback to default logging
            super().log_message(format, *args)
        return

print("🚀 Instagram DM Tool Installer Server")
print("=" * 50)
print(f"📂 Serving files from: {os.getcwd()}")
print(f"🌐 Server running on port: {PORT}")
print()
print("📋 Available installers:")
for file in os.listdir('.'):
    if file.endswith('.exe'):
        size = os.path.getsize(file) / (1024*1024)  # MB
        print(f"  📄 {file} ({size:.1f} MB)")

print()
print("🔗 To download on your Windows laptop:")
print("   1. Make sure both devices are on the same WiFi network")
print("   2. On Windows, open browser and go to:")
print(f"      http://YOUR_LINUX_IP_ADDRESS:{PORT}")
print("   3. Click on the installer you want to download")
print()
print("💡 To find your Linux IP address, run: ip addr show")
print("   Press Ctrl+C to stop the server")
print("=" * 50)

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
        # Allow socket reuse to avoid "Address already in use" errors
        httpd.allow_reuse_address = True
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n\n✅ Server stopped. Have a great day!")
    sys.exit(0)
except OSError as e:
    if e.errno == 98:  # Address already in use
        print(f"\n❌ Port {PORT} is already in use!")
        print("💡 Try waiting a moment and running the script again.")
        print("   Or check if another process is using the port with: lsof -i :8080")
    else:
        print(f"\n❌ Server error: {e}")
    sys.exit(1)
