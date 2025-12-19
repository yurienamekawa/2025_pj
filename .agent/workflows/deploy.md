---
description: Deploy the application
---

# Deploy Application

Deploy your application to a hosting service.

## Common Deployment Options

### Option 1: GitHub Pages (Static Sites)

1. **Ensure your project is in a Git repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a GitHub repository and push**
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

3. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Select source branch (usually `main`)
   - Save and wait for deployment

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy
   ```

3. **Deploy to production**
   ```bash
   netlify deploy --prod
   ```

### Option 3: Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

## Notes

- Make sure to build your project before deploying if needed
- Check for environment variables that need to be set
- Verify all paths are correct for production
