#!/bin/bash

# GitHub Repository Cloner - Database Version
# Clones repositories using URLs from the database (no API calls needed)
# Usage: ./clone_from_db.sh <target_directory> <github_token>

# Check if required arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <target_directory> <github_token>"
    echo "Example: $0 ./github_repos ghp_yourtoken"
    exit 1
fi

TARGET_DIR="$1"
TOKEN="$2"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR" || exit 1

echo "GitHub Repository Cloner - Database Version"
echo "Target directory: $(pwd)"
echo ""

# Function to check if a directory exists and is a git repo
is_git_repo() {
    [ -d "$1/.git" ]
}

# Function to clone or update a repository
clone_or_update_repo() {
    local full_name="$1"  # Format: org/repo
    local repo_name="${full_name##*/}"  # Extract repo name
    local target_path="$repo_name"
    
    echo "Processing: $full_name"
    
    if [ -d "$target_path" ]; then
        if is_git_repo "$target_path"; then
            echo "  → Already exists, updating..."
            (cd "$target_path" && git pull)
        else
            echo "  → Directory exists but is not a git repo, skipping..."
        fi
    else
        echo "  → Cloning..."
        git clone "https://$TOKEN@github.com/$full_name.git" "$target_path"
    fi
    
    echo ""
}

# Get all GitHub repositories from the database
echo "Fetching repository list from database..."
repos=$(docker-compose exec postgres psql -U postgres -d ctodash -t -c "
    SELECT DISTINCT entity 
    FROM metrics 
    WHERE source = 'github' 
    AND entity LIKE '%/%' 
    ORDER BY entity;
")

if [ -z "$repos" ]; then
    echo "ERROR: No GitHub repositories found in database"
    exit 1
fi

repo_count=$(echo "$repos" | wc -l)
echo "Found $repo_count repositories in database:"
echo "$repos"
echo ""
echo "Starting clone/update process..."
echo ""

# Clone or update each repository
success_count=0
fail_count=0

while IFS= read -r repo; do
    if [ -n "$repo" ]; then
        if clone_or_update_repo "$repo"; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
        fi
        
        # Small delay between clones
        sleep 1
    fi
done <<< "$repos"

echo "Process completed!"
echo "Successful: $success_count"
echo "Failed: $fail_count"
echo "Total repositories processed: $repo_count"
echo "Results saved in: $TARGET_DIR"