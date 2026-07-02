#!/bin/bash

# GitHub Repository Cloner - Debug Version
# Clones all repositories from a GitHub organization locally
# Usage: ./clone_all_repos_debug.sh <github_org> <access_token> <target_directory>

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

# Log file for debugging
LOG_FILE="github_clone_$(date +%Y%m%d_%H%M%S).log"
echo "Logging to: $LOG_FILE"

# Function to log messages with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check API rate limits
check_rate_limit() {
    log "Checking GitHub API rate limit..."
    
    local response=$(curl -s -I -H "Authorization: token $TOKEN" \
                   -H "Accept: application/vnd.github+json" \
                   "https://api.github.com/orgs/$ORG/repos" 2>&1)
    
    if echo "$response" | grep -q "403"; then
        log "ERROR: API rate limit exceeded"
        echo "$response" | grep -i "x-rate" >> "$LOG_FILE"
        return 1
    fi
    
    echo "$response" | grep -i "x-rate" >> "$LOG_FILE"
    
    local remaining=$(echo "$response" | grep -i "X-RateLimit-Remaining" | awk '{print $2}' | tr -d '\r')
    local limit=$(echo "$response" | grep -i "X-RateLimit-Limit" | awk '{print $2}' | tr -d '\r')
    
    log "Rate limit: $remaining/$limit requests remaining"
    
    if [ "$remaining" -lt 10 ]; then
        log "WARNING: Low rate limit remaining ($remaining requests)"
        return 1
    fi
    
    return 0
}

# Function to get repositories with better error handling
get_repositories() {
    local page=1
    local all_repos=()
    local max_retries=3
    
    while true; do
        local retry=0
        local success=0
        
        while [ $retry -lt $max_retries ]; do
            log "Fetching repositories (page $page, attempt $((retry+1)))..."
            
            # Use GitHub API to get repositories
            response=$(curl -s -H "Authorization: token $TOKEN" \
                      -H "Accept: application/vnd.github+json" \
                      "https://api.github.com/orgs/$ORG/repos?per_page=100&page=$page" 2>> "$LOG_FILE")
            
            # Check for rate limit errors
            if echo "$response" | grep -q "API rate limit exceeded"; then
                log "ERROR: GitHub API rate limit exceeded on page $page"
                echo "$response" | jq '.' >> "$LOG_FILE"
                return 1
            fi
            
            # Check for other errors
            if echo "$response" | grep -q ""message""; then
                error_msg=$(echo "$response" | jq -r '.message // "Unknown error"')
                log "ERROR: $error_msg"
                echo "$response" | jq '.' >> "$LOG_FILE"
                retry=$((retry + 1))
                sleep $((2 ** retry))  # Exponential backoff
                continue
            fi
            
            # If we get here, the request succeeded
            success=1
            break
        done
        
        if [ $success -eq 0 ]; then
            log "ERROR: Failed to fetch page $page after $max_retries attempts"
            return 1
        fi
        
        # Extract repository names
        repos=$(echo "$response" | jq -r '.[].name' 2>> "$LOG_FILE")
        
        if [ -z "$repos" ] || [ "$repos" = "null" ]; then
            log "No more repositories found"
            break
        fi
        
        # Add to our array
        while IFS= read -r repo; do
            all_repos+=("$repo")
        done <<< "$repos"
        
        # Check if we have less than 100 results (last page)
        repo_count=$(echo "$response" | jq '. | length')
        if [ "$repo_count" -lt 100 ]; then
            log "Reached last page ($page) with $repo_count repositories"
            break
        fi
        
        page=$((page + 1))
        
        # Be respectful to GitHub's rate limits
        if ! check_rate_limit; then
            log "Pausing due to rate limit concerns..."
            sleep 60
        else
            sleep 2
        fi
    done
    
    echo "${all_repos[@]}"
}

# Function to clone or update a repository with error handling
clone_or_update_repo() {
    local repo_name="$1"
    local target_path="$2"
    local max_retries=2
    
    if [ -d "$target_path" ]; then
        if [ -d "$target_path/.git" ]; then
            log "Repository $repo_name already exists, updating..."
            local retry=0
            while [ $retry -lt $max_retries ]; do
                if (cd "$target_path" && git pull); then
                    return 0
                else
                    retry=$((retry + 1))
                    log "WARNING: Git pull failed for $repo_name (attempt $retry/$max_retries)"
                    sleep $((2 ** retry))
                fi
            done
            log "ERROR: Failed to update $repo_name after $max_retries attempts"
            return 1
        else
            log "WARNING: Directory $target_path exists but is not a git repo, skipping..."
            return 1
        fi
    else
        log "Cloning $repo_name..."
        local retry=0
        while [ $retry -lt $max_retries ]; do
            if git clone "https://$TOKEN@github.com/$ORG/$repo_name.git" "$target_path" 2>> "$LOG_FILE"; then
                return 0
            else
                retry=$((retry + 1))
                log "WARNING: Git clone failed for $repo_name (attempt $retry/$max_retries)"
                sleep $((2 ** retry))
            fi
        done
        log "ERROR: Failed to clone $repo_name after $max_retries attempts"
        return 1
    fi
}

# Main execution
log "Starting GitHub repository clone process..."
log "Organization: $ORG"
log "Target directory: $(pwd)"
log ""

# Check rate limit before starting
if ! check_rate_limit; then
    log "ERROR: Cannot proceed due to rate limit issues"
    exit 1
fi

# Get all repositories
repos=$(get_repositories)

if [ $? -ne 0 ]; then
    log "ERROR: Failed to fetch repositories"
    exit 1
fi

repo_count=$(echo "$repos" | wc -w)
log "Found $repo_count repositories to clone/update"
log ""

# Clone or update each repository
success_count=0
fail_count=0

for repo in $repos; do
    if clone_or_update_repo "$repo" "$repo"; then
        success_count=$((success_count + 1))
    else
        fail_count=$((fail_count + 1))
    fi
    
    # Small delay between clones to be gentle on GitHub
    sleep 1
    
echo ""
done

log "Repository clone/update process completed!"
log "Successful: $success_count"
log "Failed: $fail_count"
log "Total repositories processed: $repo_count"
log "Results saved in: $TARGET_DIR"
log "Full log available in: $LOG_FILE"