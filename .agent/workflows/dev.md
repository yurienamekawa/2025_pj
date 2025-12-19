---
description: Start the development server
---

# Development Server

Start a local development server to preview your project.

## Steps

1. **Check if you need a dev server**
   - For simple HTML/CSS/JS projects, you can use a simple HTTP server
   - For framework-based projects (React, Vue, etc.), use the framework's dev command

2. **For simple projects - Start Python HTTP server**
   ```bash
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000 in your browser

3. **For Node.js projects - Use npm/yarn**
   ```bash
   npm run dev
   ```
   or
   ```bash
   npm start
   ```

## Notes

- The server will typically auto-reload when you make changes to your files
- Check your project's `package.json` for available scripts
- Default ports are usually 3000, 5173, or 8000 depending on the tool
