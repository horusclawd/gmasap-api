#!/bin/bash

# GMASAP API - GitHub Repository Setup for horusclawd account
# This script sets up the complete repository with proper branch structure

set -e  # Exit on any error

echo "🚀 Setting up GMASAP API Repository for horusclawd account..."

# Ensure we're in the right directory
if [[ ! -f "template.yaml" ]]; then
    echo "❌ Error: template.yaml not found. Run this script from the gmasap-api project root."
    exit 1
fi

# Initialize git repository if not already done
if [[ ! -d ".git" ]]; then
    echo "📂 Initializing Git repository..."
    git init
else
    echo "📂 Git repository already initialized"
fi

# Configure git if not already configured
if [[ -z "$(git config user.name)" ]]; then
    echo "⚙️ Configuring Git user (update these as needed)..."
    git config user.name "HorusClawd"
    git config user.email "admin@horusclawd.dev"
fi

# Add all files to staging
echo "📋 Adding project files..."
git add .

# Create initial commit if no commits exist
if [[ -z "$(git log --oneline 2>/dev/null)" ]]; then
    echo "💾 Creating initial commit..."
    git commit -m "🚀 Initial commit: GMASAP API Sprint 1.1 Complete

✅ Complete serverless AWS backend infrastructure
✅ Event-driven architecture with EventBridge  
✅ Cost-optimized design: \$29/month vs \$65/month original
✅ DynamoDB-first approach with GSI search capabilities
✅ SAM template with all AWS resources configured
✅ Lambda functions: Auth, Athletes, Feed services
✅ Comprehensive shared utilities and middleware
✅ JWT authentication with bcrypt password hashing
✅ Error handling and response standardization
✅ Local development environment ready
✅ Extensive documentation and deployment guides

Architecture Highlights:
- AWS SAM serverless framework
- DynamoDB with GSI indexes for cost-effective search
- EventBridge for event-driven microservices
- S3 for media storage with presigned URLs
- API Gateway with CORS and rate limiting
- Lambda functions with shared utility layer
- JWT-based authentication system
- Comprehensive error handling

Sprint 1.1 infrastructure deliverables complete ✅
Ready for Sprint 1.2 auth implementation"
else
    echo "📝 Repository already has commits"
fi

# Ensure we're on main branch
echo "🌿 Setting up main branch..."
git branch -M main

# Check if GitHub CLI is available and authenticated
if command -v gh &> /dev/null; then
    if gh auth status &> /dev/null; then
        echo "🔑 GitHub CLI is authenticated"
        
        # Create repository if it doesn't exist
        if ! gh repo view horusclawd/gmasap-api &> /dev/null; then
            echo "🏗️ Creating GitHub repository: horusclawd/gmasap-api"
            gh repo create horusclawd/gmasap-api \
                --private \
                --description "🏈 GMASAP Serverless API Backend - Event-driven AWS architecture for athlete recruitment platform" \
                --clone=false
            
            echo "✅ Repository created successfully"
        else
            echo "📁 Repository horusclawd/gmasap-api already exists"
        fi
        
        # Set remote origin
        if ! git remote get-url origin &> /dev/null; then
            echo "🔗 Adding remote origin..."
            git remote add origin https://github.com/horusclawd/gmasap-api.git
        else
            echo "🔗 Remote origin already configured"
        fi
        
        # Push to main branch
        echo "🚀 Pushing to main branch..."
        git push -u origin main
        
        # Create and push Sprint 1.1 infrastructure branch
        echo "🌿 Creating sprint-1.1-infrastructure branch..."
        if ! git show-ref --quiet refs/heads/sprint-1.1-infrastructure; then
            git checkout -b sprint-1.1-infrastructure
            git push -u origin sprint-1.1-infrastructure
            echo "✅ sprint-1.1-infrastructure branch created and pushed"
        else
            echo "📝 sprint-1.1-infrastructure branch already exists"
            git checkout sprint-1.1-infrastructure
            git push -u origin sprint-1.1-infrastructure
        fi
        
        echo ""
        echo "🎉 SUCCESS! Repository setup complete!"
        echo ""
        echo "📊 Repository Details:"
        echo "   🔗 URL: https://github.com/horusclawd/gmasap-api"
        echo "   🔒 Visibility: Private"
        echo "   🌿 Branches: main, sprint-1.1-infrastructure"
        echo "   📂 Files: $(git ls-files | wc -l | tr -d ' ') files committed"
        echo ""
        echo "📋 Current Status:"
        echo "   🌿 Active branch: $(git branch --show-current)"
        echo "   💾 Last commit: $(git log -1 --oneline)"
        echo ""
        echo "🎯 Next Steps:"
        echo "   1. 🔍 Review code at: https://github.com/horusclawd/gmasap-api"
        echo "   2. 🏗️ Deploy to AWS: sam build && sam deploy --guided"
        echo "   3. 🧪 Test API endpoints with sample events"
        echo "   4. 🚀 Begin Sprint 1.2: Authentication implementation"
        echo "   5. 📱 Update frontend to use live API endpoints"
        
    else
        echo "❌ GitHub CLI not authenticated. Please run: gh auth login"
        echo "   Then re-run this script"
        exit 1
    fi
else
    echo "❌ GitHub CLI not found. Please install it:"
    echo "   macOS: brew install gh"
    echo "   Ubuntu: sudo apt install gh"
    echo "   Or visit: https://cli.github.com/"
    echo ""
    echo "🔧 Alternative manual setup:"
    echo "   1. Create repository manually at: https://github.com/new"
    echo "   2. Repository name: gmasap-api"
    echo "   3. Owner: horusclawd"
    echo "   4. Visibility: Private"
    echo "   5. Run these commands:"
    echo ""
    echo "   git remote add origin https://github.com/horusclawd/gmasap-api.git"
    echo "   git push -u origin main"
    echo "   git checkout -b sprint-1.1-infrastructure"
    echo "   git push -u origin sprint-1.1-infrastructure"
    exit 1
fi