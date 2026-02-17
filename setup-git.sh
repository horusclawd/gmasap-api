#!/bin/bash

# GMASAP API - Git Repository Setup Script
# Run this from your local machine after copying the files

echo "🚀 Setting up GMASAP API Git Repository..."

# Initialize git repository
git init

# Create initial commit on main
git add .
git commit -m "Initial commit: GMASAP API infrastructure

- Complete SAM template with optimized architecture
- Event-driven design with EventBridge
- DynamoDB-first approach with GSIs for search
- Cost-optimized: $29/month vs $65/month original
- Auth service with JWT + bcrypt
- Comprehensive shared utilities
- Local development environment ready

Sprint 1.1 deliverables complete ✅"

# Create GitHub repository (replace with your GitHub username/org)
echo "Creating GitHub repository..."
gh repo create gmasap/gmasap-api --private --description "GMASAP Serverless API Backend - Event-driven architecture on AWS"

# Push to GitHub
git branch -M main
git remote add origin https://github.com/gmasap/gmasap-api.git
git push -u origin main

# Create Sprint 1.1 branch as planned in architecture
echo "Creating Sprint 1.1 infrastructure branch..."
git checkout -b sprint-1.1-infrastructure
git push -u origin sprint-1.1-infrastructure

echo "✅ Repository setup complete!"
echo "📂 GitHub: https://github.com/gmasap/gmasap-api"
echo "🌿 Current branch: sprint-1.1-infrastructure"
echo ""
echo "Next steps:"
echo "1. Review the code in your editor"
echo "2. Run: sam build && sam deploy --guided"
echo "3. Test the deployed API endpoints"
echo "4. Start Sprint 1.2 development"