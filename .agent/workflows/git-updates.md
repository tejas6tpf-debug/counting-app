---
description: How to push new updates to Git/GitHub
---

## Pushing Updates to GitHub

Follow these steps to upload your recent changes:

1. **Option A: Using the Batch Script (Recommended)**
   - Find [PUSH_UPDATES.bat](file:///d:/Counting%20App/PUSH_UPDATES.bat) in your project folder.
   - Double-click it. It will automatically add, commit, and push your changes.

2. **Option B: Manual Commands**
   - Open terminal in the project folder.
   - Run: `git add .`
   - Run: `git commit -m "Description of your changes"`
   - Run: `git push origin main`

> [!TIP]
> Always make sure your dev server is stopped or stable before pushing large updates to avoid file lock issues.
