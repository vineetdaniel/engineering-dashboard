#!/bin/bash

# GitHub Repository Cloner
# Clones all repositories from a GitHub organization locally
# Usage: ./clone_all_repos.sh <github_org> <access_token> <target_directory>

# Check if required arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <github_org> <access_token> <target_directory>"
    echo "Example: $0 hueytechinfra ghp_yourtoken ./repos"
    exit 1
fi

ORG="$1"
TOKEN="$2"
TARGET_DIR="$3"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR" || exit 1

# Temporary file to store repository list
TEMP_FILE="/tmp/github_repos_$$.json"

# Function to check if a directory exists and is a git repo
is_git_repo() {
    [ -d "$1/.git" ]
}

# Function to clone or update a repository
clone_or_update_repo() {
    local repo_name="$1"
    local target_path="$2"
    
    if [ -d "$target_path" ]; then
        if is_git_repo "$target_path"; then
            echo "Repository $repo_name already exists, updating..."
            (cd "$target_path" && git pull)
        else
            echo "Directory $target_path exists but is not a git repo, skipping..."
        fi
    else
        echo "Cloning $repo_name..."
        git clone "https://$TOKEN@github.com/$ORG/$repo_name.git" "$target_path"
    fi
}

# Function to get all repositories with pagination
get_all_repositories() {
    local page=1
    local all_repos=()
    
    while true; do
        echo "Fetching repositories (page $page)..."
        
        # Use GitHub API to get repositories
        response=$(curl -s -H "Authorization: token $TOKEN" \
                  -H "Accept: application/vnd.github+json" \
                  "https://api.github.com/orgs/$ORG/repos?per_page=100&page=$page")
        
        # Check for errors
        if echo "$response" | grep -q "API rate limit exceeded"; then
            echo "Error: GitHub API rate limit exceeded"
            return 1
        fi
        
        # Extract repository names
        repos=$(echo "$response" | jq -r '.[].name')
        
        if [ -z "$repos" ] || [ "$repos" = "null" ]; then
            break
        fi
        
        # Add to our array
        while IFS= read -r repo; do
            all_repos+=("$repo")
        done <<< "$repos"
        
        # Check if we have less than 100 results (last page)
        repo_count=$(echo "$response" | jq '. | length')
        if [ "$repo_count" -lt 100 ]; then
            break
        fi
        
        page=$((page + 1))
        
        # Be respectful to GitHub's rate limits
        sleep 2
    done
    
    echo "${all_repos[@]}"
}

# Main execution
echo "Starting GitHub repository clone process..."
echo "Organization: $ORG"
echo "Target directory: $(pwd)"
echo ""

# Get all repositories
repos=$(get_all_repositories)

if [ $? -ne 0 ]; then
    echo "Failed to fetch repositories"
    exit 1
fi

repo_count=$(echo "$repos" | wc -w)
echo "Found $repo_count repositories to clone/update"
echo ""

# Clone or update each repository
for repo in $repos; do
    clone_or_update_repo "$repo" "$repo"
    
    # Small delay between clones to be gentle on GitHub
    sleep 1
    
echo ""
done

echo "Repository clone/update process completed!"
echo "Total repositories processed: $repo_count"
echo "Results saved in: $TARGET_DIR"

# Clean up
rm -f "$TEMP_FILE"