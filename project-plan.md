The canvas file lives outside your repo, in Cursor's local data folder:

```
~/.cursor/projects/Users-yassersalama-repos-goldcompass-v2/canvases/goldcompass-product-plan.canvas.tsx
```

**Moving it to another device:**

1. **Copy the file** from the path above on your current machine
2. On the other device, open the repo in Cursor — this creates the project folder automatically
3. The destination path will follow the same pattern, based on where you clone the repo:
   - If the repo is at `/Users/<you>/repos/goldcompass-v2`, the path becomes:
     `~/.cursor/projects/Users-<you>-repos-goldcompass-v2/canvases/`
   - If it's in a different location, adjust the folder name accordingly (Cursor encodes the absolute repo path, replacing `/` with `-`)
4. Drop the `.canvas.tsx` file into that `canvases/` folder and it will be immediately available

**The quick formula:**
Take your repo's absolute path → strip the leading `/` → replace every `/` with `-` → that's the folder name under `~/.cursor/projects/`.

For example:
- Repo at `/Users/john/code/goldcompass-v2`
- Canvas folder: `~/.cursor/projects/Users-john-code-goldcompass-v2/canvases/`