# Predictify

Developed by clout.

1. Push this folder to a GitHub repo (or drag it into Netlify: Add new site, Deploy manually).
2. On Netlify choose "Import from Git", pick the repo. Build settings are read from netlify.toml. Deploy.
3. Open the site on your phone and add it to your home screen.

Backend is a Netlify Function (netlify/functions/api.mjs) using Netlify Blobs for storage. Both are on Netlify's free tier.
Test locally with: npm i -g netlify-cli && npm i && netlify dev
