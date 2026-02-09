---

# Deploy to GitHub Pages

This guide will help you deploy your ATM Locator PWA to GitHub Pages for free hosting.

## Prerequisites
- GitHub account (you have one!)
- Git installed on your computer (already available)

## Step-by-Step Deployment

### 1. Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: `atm-locator` (or any name you prefer)
3. Visibility: Public (required for free GitHub Pages)
4. Click **"Create repository"**

### 2. Connect Local Repository to GitHub

Run these commands in your project directory:

```bash
# Add the GitHub repository as remote
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/atm-locator.git

# Push your code to GitHub
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (tab at the top)
3. Scroll down to **Pages** section (left sidebar)
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**

### 4. Wait for Deployment

- GitHub will build and deploy your site (takes 1-2 minutes)
- Refresh the Pages settings page to see your URL
- It will be: `https://YOUR_USERNAME.github.io/atm-locator/`

### 5. Install on Your Phone

1. Open the deployed URL on your phone's browser
2. You should see an "Add to Home Screen" or "Install" prompt
3. Tap it to install as a PWA
4. The app will work offline!

## Updating Your Site

Whenever you make changes:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

GitHub will automatically redeploy your site!

---