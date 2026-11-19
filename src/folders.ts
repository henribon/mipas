// Folders group the owner's lists, like Spotify's playlist folders, and may sit
// inside one another. A folder or list whose parent is gone, or caught in a loop,
// shows at the top level instead of disappearing.

export type Folder = { id: string; name: string; parent_id: string | null; created_at?: string };
type ListLike = { id: string; folder_id?: string | null };

export function folderTree(folders: Folder[], lists: ListLike[]) {
  const byId = new Map(folders.map(f => [f.id, f]));

  const parents = new Map<string, string | null>();
  const parentOf = (id: string | null): string | null => {
    if (!id) return null;
    if (parents.has(id)) return parents.get(id);
    const raw = byId.get(id)?.parent_id;
    let parent = raw && byId.has(raw) ? raw : null;
    const seen = new Set<string>();
    for (let cur = parent; cur && !seen.has(cur); cur = byId.get(cur)?.parent_id) {
      if (cur === id) { parent = null; break; }
      seen.add(cur);
    }
    parents.set(id, parent);
    return parent;
  };

  const folderOf = (list: ListLike) => (list.folder_id && byId.has(list.folder_id) ? list.folder_id : null);

  const isInside = (id: string | null, ancestorId: string) => {
    for (let cur = id; cur; cur = parentOf(cur)) if (cur === ancestorId) return true;
    return false;
  };

  const childFolders = (id: string | null) => folders.filter(f => parentOf(f.id) === id);
  const childLists = <T extends ListLike>(id: string | null) => (lists as T[]).filter(l => folderOf(l) === id);
  const listsInside = <T extends ListLike>(id: string) => (lists as T[]).filter(l => isInside(folderOf(l), id));
  const foldersInside = (id: string) => folders.filter(f => f.id !== id && isInside(f.id, id));

  // From the top level down to the folder itself.
  const path = (id: string | null) => {
    const out: Folder[] = [];
    for (let cur = id; cur && byId.has(cur); cur = parentOf(cur)) out.unshift(byId.get(cur));
    return out;
  };

  // Every folder in display order, each with its depth, for the "move to" menus.
  const flat = () => {
    const out: { folder: Folder; depth: number }[] = [];
    const walk = (id: string | null, depth: number) => childFolders(id).forEach(folder => {
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    });
    walk(null, 0);
    return out;
  };

  return { byId, parentOf, folderOf, isInside, childFolders, childLists, listsInside, foldersInside, path, flat };
}

export type FolderTree = ReturnType<typeof folderTree>;
