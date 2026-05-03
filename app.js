const STORAGE_KEY = 'taskmanager_tasks';
const CAT_STORAGE_KEY = 'taskmanager_categories';

const COLOR_PALETTE = [
  '#7c6ef7','#6e9ef7','#6ef7e8','#6ef7a2',
  '#f7e96e','#f7c96e','#f7896e','#f76e9e',
  '#c46ef7','#6eb8f7','#b0f76e','#f76e6e'
];

const DEFAULT_CATEGORIES = [
  { id: 'work',     name: 'Work',     color: '#7c6ef7' },
  { id: 'personal', name: 'Personal', color: '#6ef7a2' },
  { id: 'health',   name: 'Health',   color: '#f7896e' },
  { id: 'finance',  name: 'Finance',  color: '#f7c96e' },
];

let tasks      = loadTasks();
let categories = loadCategories();
let activeCategory = null; // null = All
let dragSrc = null;
let dragSrcCat = null;
let selectedColor = COLOR_PALETTE[0];

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function loadCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem(CAT_STORAGE_KEY));
    return stored || DEFAULT_CATEGORIES;
  } catch { return DEFAULT_CATEGORIES; }
}

function saveTasks()      { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function saveCategories() { localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(categories)); }

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getCat(id) {
  return categories.find(c => c.id === id) || null;
}

// ─── Due date helpers ───────────────────────────────────────────────────────

function dueBadge(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr + 'T00:00:00');
  const diff = (due - today) / 86400000;
  if (diff < 0)   return `<span class="due-badge overdue">Overdue</span>`;
  if (diff === 0) return `<span class="due-badge today">Today</span>`;
  return `<span class="due-badge upcoming">${due.toLocaleDateString(undefined, { month:'short', day:'numeric' })}</span>`;
}

function subtaskDueClass(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr + 'T00:00:00');
  const diff = (due - today) / 86400000;
  if (diff < 0)   return 'overdue';
  if (diff === 0) return 'today';
  return '';
}

function subtaskDueLabel(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr + 'T00:00:00');
  const diff = (due - today) / 86400000;
  if (diff < 0)   return 'Overdue';
  if (diff === 0) return 'Today';
  return due.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}

// ─── Category badge ─────────────────────────────────────────────────────────

function catBadgeHtml(catId) {
  if (!catId) return '';
  const cat = getCat(catId);
  if (!cat) return '';
  return `<span class="cat-badge" style="background:${cat.color}22; color:${cat.color}">
    <span class="cat-badge-dot" style="background:${cat.color}"></span>${escHtml(cat.name)}
  </span>`;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function countForCat(catId) {
  if (catId === null) return tasks.length;
  return tasks.filter(t =>
    t.categoryId === catId ||
    t.subtasks.some(s => s.categoryId === catId)
  ).length;
}

function renderSidebar() {
  const list = document.getElementById('category-list');
  const allCount = tasks.length;

  const allItem = `
    <li class="cat-item ${activeCategory === null ? 'active' : ''}" onclick="setCategory(null)">
      <span class="cat-dot all"></span>
      <span class="cat-name">All Tasks</span>
      <span class="cat-count">${allCount}</span>
    </li>`;

  const catItems = categories.map((cat, ci) => {
    const count = tasks.filter(t =>
      t.categoryId === cat.id || t.subtasks.some(s => s.categoryId === cat.id)
    ).length;
    return `
      <li class="cat-item ${activeCategory === cat.id ? 'active' : ''}"
          draggable="true"
          ondragstart="onCatDragStart(event, ${ci})"
          ondragover="onCatDragOver(event, ${ci})"
          ondrop="onCatDrop(event, ${ci})"
          ondragleave="onCatDragLeave(event)"
          ondragend="onCatDragEnd(event)"
          onclick="setCategory('${cat.id}')">
        <span class="cat-dot clickable" style="background:${cat.color}" onclick="openColorPicker(event,'${cat.id}')" title="Change color"></span>
        <span class="cat-name">${escHtml(cat.name)}</span>
        <span class="cat-count">${count}</span>
        <button class="cat-edit" onclick="renameCategory(event,'${cat.id}')" title="Rename">✏️</button>
        <button class="cat-delete" onclick="deleteCategory(event,'${cat.id}')" title="Delete">×</button>
      </li>`;
  }).join('');

  list.innerHTML = allItem + catItems;
  populateCategorySelects();
}

function setCategory(catId) {
  activeCategory = catId;
  const title = catId === null ? 'All Tasks' : (getCat(catId)?.name || 'All Tasks');
  document.getElementById('view-title').textContent = title;
  renderSidebar();
  renderTasks();
}

// ─── Task rendering ──────────────────────────────────────────────────────────

function renderTasks() {
  const list = document.getElementById('task-list');

  let visible = tasks;
  if (activeCategory !== null) {
    visible = tasks.filter(t =>
      t.categoryId === activeCategory ||
      t.subtasks.some(s => s.categoryId === activeCategory)
    );
  }

  if (visible.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>No tasks here yet.</p></div>`;
    return;
  }

  list.innerHTML = visible.map((task) => {
    const ti = tasks.indexOf(task);
    const subtasksDone  = task.subtasks.filter(s => s.completed).length;
    const subtaskTotal  = task.subtasks.length;
    const subtaskCountHtml = subtaskTotal > 0
      ? `<span class="subtask-count">${subtasksDone}/${subtaskTotal} subtasks</span>` : '';

    const priority = task.priority || 'none';
    const priorityBadge = priority !== 'none'
      ? `<button class="priority-badge ${priority} clickable" onclick="cyclePriority(event, ${ti})" title="Change priority">${priority}</button>`
      : `<button class="priority-badge none clickable" onclick="cyclePriority(event, ${ti})" title="Set priority">+ priority</button>`;

    const subtaskListHtml = task.subtasks.map((sub, si) => {
      const subCat = getCat(sub.categoryId);
      const subCatDot = subCat
        ? `<span class="subtask-cat-dot" title="${escHtml(subCat.name)}" style="background:${subCat.color}"></span>` : '';
      return `
        <div class="subtask-item ${sub.completed ? 'completed' : ''}">
          <div class="subtask-checkbox ${sub.completed ? 'checked' : ''}"
               onclick="toggleSubtask(${ti}, ${si})">${sub.completed ? '✓' : ''}</div>
          <span class="subtask-text">${escHtml(sub.title)}</span>
          ${sub.dueDate ? `<span class="subtask-due ${subtaskDueClass(sub.dueDate)}">${subtaskDueLabel(sub.dueDate)}</span>` : ''}
          ${subCatDot}
          <button class="btn-icon danger" onclick="deleteSubtask(${ti}, ${si})">×</button>
        </div>`;
    }).join('');

    const catSelectOptions = `<option value="">No category</option>` +
      categories.map(c => `<option value="${c.id}" ${c.id === task.categoryId ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');

    return `
      <div class="task-card ${task.completed ? 'completed' : ''} ${priority !== 'none' ? 'priority-' + priority : ''}"
           draggable="true"
           data-index="${ti}"
           ondragstart="onDragStart(event, ${ti})"
           ondragover="onDragOver(event, ${ti})"
           ondrop="onDrop(event, ${ti})"
           ondragleave="onDragLeave(event)"
           ondragend="onDragEnd(event)">
        <div class="task-header">
          <span class="drag-handle">⠿</span>
          <div class="task-checkbox ${task.completed ? 'checked' : ''}"
               onclick="toggleTask(${ti})">${task.completed ? '✓' : ''}</div>
          <div class="task-body">
            <div class="task-title">${escHtml(task.title)}</div>
            <div class="task-meta">
              ${priorityBadge}
              ${dueBadge(task.dueDate)}
              ${catBadgeHtml(task.categoryId)}
              ${subtaskCountHtml}
            </div>
          </div>
          <div class="task-actions">
            <button class="btn-icon expand-btn ${task.expanded ? 'open' : ''}"
                    onclick="toggleExpand(${ti})">▼</button>
            <button class="btn-icon danger" onclick="deleteTask(${ti})">🗑</button>
          </div>
        </div>
        <div class="subtasks-panel ${task.expanded ? 'open' : ''}">
          <div class="subtask-list">${subtaskListHtml}</div>
          <div class="add-subtask-form">
            <input type="text" id="sub-title-${ti}" placeholder="Add subtask..."
                   onkeydown="if(event.key==='Enter') addSubtask(${ti})" />
            <input type="date" id="sub-due-${ti}" />
            <select id="sub-cat-${ti}">
              <option value="">No category</option>
              ${categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
            </select>
            <button class="add-subtask-btn" onclick="addSubtask(${ti})">+ Add</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function render() {
  renderSidebar();
  renderTasks();
}

// ─── Task actions ────────────────────────────────────────────────────────────

function toggleTask(ti) {
  tasks[ti].completed = !tasks[ti].completed;
  saveTasks(); render();
}

function toggleExpand(ti) {
  tasks[ti].expanded = !tasks[ti].expanded;
  saveTasks(); render();
}

function deleteTask(ti) {
  tasks.splice(ti, 1);
  saveTasks(); render();
}

function cyclePriority(e, ti) {
  e.stopPropagation();
  const order = ['none', 'low', 'medium', 'high'];
  const current = tasks[ti].priority || 'none';
  const next = order[(order.indexOf(current) + 1) % order.length];
  tasks[ti].priority = next;
  saveTasks(); render();
}

function toggleSubtask(ti, si) {
  tasks[ti].subtasks[si].completed = !tasks[ti].subtasks[si].completed;
  saveTasks(); render();
}

function deleteSubtask(ti, si) {
  tasks[ti].subtasks.splice(si, 1);
  saveTasks(); render();
}

function addSubtask(ti) {
  const titleEl = document.getElementById(`sub-title-${ti}`);
  const dueEl   = document.getElementById(`sub-due-${ti}`);
  const catEl   = document.getElementById(`sub-cat-${ti}`);
  const title   = titleEl.value.trim();
  if (!title) { titleEl.focus(); return; }
  tasks[ti].subtasks.push({
    id: uid(), title,
    dueDate: dueEl.value,
    categoryId: catEl.value || null,
    completed: false
  });
  tasks[ti].expanded = true;
  saveTasks(); render();
}

// ─── Add task form ───────────────────────────────────────────────────────────

function populateCategorySelects() {
  const sel = document.getElementById('new-task-category');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">No category</option>` +
    categories.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
}

document.getElementById('add-task-btn').addEventListener('click', () => {
  document.getElementById('add-task-form').classList.remove('hidden');
  if (activeCategory) {
    document.getElementById('new-task-category').value = activeCategory;
  }
  document.getElementById('new-task-title').focus();
});

document.getElementById('cancel-task-btn').addEventListener('click', resetTaskForm);

document.getElementById('save-task-btn').addEventListener('click', () => {
  const title    = document.getElementById('new-task-title').value.trim();
  const due      = document.getElementById('new-task-due').value;
  const priority = document.getElementById('new-task-priority').value;
  const catId    = document.getElementById('new-task-category').value || null;
  if (!title) { document.getElementById('new-task-title').focus(); return; }
  tasks.push({ id: uid(), title, dueDate: due, priority, categoryId: catId,
               completed: false, expanded: false, subtasks: [] });
  saveTasks(); render();
  resetTaskForm();
});

document.getElementById('new-task-title').addEventListener('keydown', e => {
  if (e.key === 'Enter')  document.getElementById('save-task-btn').click();
  if (e.key === 'Escape') resetTaskForm();
});

function resetTaskForm() {
  document.getElementById('add-task-form').classList.add('hidden');
  document.getElementById('new-task-title').value = '';
  document.getElementById('new-task-due').value = '';
  document.getElementById('new-task-priority').value = 'none';
  document.getElementById('new-task-category').value = '';
}

// ─── Category management ─────────────────────────────────────────────────────

function renderSwatches() {
  const container = document.getElementById('color-swatches');
  container.innerHTML = COLOR_PALETTE.map(color => `
    <div class="swatch ${color === selectedColor ? 'selected' : ''}"
         style="background:${color}"
         onclick="selectColor('${color}')"></div>
  `).join('');
}

function selectColor(color) {
  selectedColor = color;
  renderSwatches();
}

document.getElementById('add-cat-btn').addEventListener('click', () => {
  document.getElementById('add-cat-form').classList.remove('hidden');
  document.getElementById('add-cat-btn').style.display = 'none';
  selectedColor = COLOR_PALETTE[categories.length % COLOR_PALETTE.length];
  renderSwatches();
  document.getElementById('cat-name-input').focus();
});

document.getElementById('cancel-cat-btn').addEventListener('click', closeCatForm);

document.getElementById('save-cat-btn').addEventListener('click', () => {
  const name = document.getElementById('cat-name-input').value.trim();
  if (!name) { document.getElementById('cat-name-input').focus(); return; }
  categories.push({ id: uid(), name, color: selectedColor });
  saveCategories();
  closeCatForm();
  render();
});

document.getElementById('cat-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  document.getElementById('save-cat-btn').click();
  if (e.key === 'Escape') closeCatForm();
});

function closeCatForm() {
  document.getElementById('add-cat-form').classList.add('hidden');
  document.getElementById('add-cat-btn').style.display = '';
  document.getElementById('cat-name-input').value = '';
}

function openColorPicker(e, catId) {
  e.stopPropagation();
  closeColorPicker();
  const cat = getCat(catId);
  if (!cat) return;
  const popup = document.createElement('div');
  popup.id = 'color-picker-popup';
  popup.innerHTML = COLOR_PALETTE.map(color => `
    <div class="swatch ${color === cat.color ? 'selected' : ''}"
         style="background:${color}"
         onclick="pickCategoryColor(event,'${catId}','${color}')"></div>
  `).join('');
  document.body.appendChild(popup);
  const rect = e.target.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.left = `${rect.left}px`;
  setTimeout(() => document.addEventListener('click', closeColorPicker, { once: true }), 0);
}

function closeColorPicker() {
  const existing = document.getElementById('color-picker-popup');
  if (existing) existing.remove();
}

function pickCategoryColor(e, catId, color) {
  e.stopPropagation();
  const cat = getCat(catId);
  if (!cat) return;
  cat.color = color;
  saveCategories();
  closeColorPicker();
  render();
}

function renameCategory(e, catId) {
  e.stopPropagation();
  const cat = getCat(catId);
  if (!cat) return;
  const next = prompt('Rename category:', cat.name);
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed || trimmed === cat.name) return;
  cat.name = trimmed;
  saveCategories();
  render();
  if (activeCategory === catId) {
    document.getElementById('view-title').textContent = trimmed;
  }
}

function deleteCategory(e, catId) {
  e.stopPropagation();
  categories = categories.filter(c => c.id !== catId);
  tasks.forEach(t => {
    if (t.categoryId === catId) t.categoryId = null;
    t.subtasks.forEach(s => { if (s.categoryId === catId) s.categoryId = null; });
  });
  if (activeCategory === catId) activeCategory = null;
  saveCategories(); saveTasks(); render();
  document.getElementById('view-title').textContent = 'All Tasks';
}

// ─── Drag and drop ───────────────────────────────────────────────────────────

function onDragStart(e, ti) {
  dragSrc = ti;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.closest('.task-card').classList.add('dragging'), 0);
}

function onDragOver(e, ti) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
  if (ti !== dragSrc) e.target.closest('.task-card')?.classList.add('drag-over');
}

function onDragLeave(e) {
  e.target.closest('.task-card')?.classList.remove('drag-over');
}

function onDrop(e, ti) {
  e.preventDefault();
  if (dragSrc === null || dragSrc === ti) return;
  const moved = tasks.splice(dragSrc, 1)[0];
  tasks.splice(ti, 0, moved);
  saveTasks(); render();
}

function onDragEnd(e) {
  dragSrc = null;
  document.querySelectorAll('.task-card').forEach(c => {
    c.classList.remove('dragging', 'drag-over');
  });
}

function onCatDragStart(e, ci) {
  dragSrcCat = ci;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.closest('.cat-item').classList.add('dragging'), 0);
}

function onCatDragOver(e, ci) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('drag-over'));
  if (ci !== dragSrcCat) e.target.closest('.cat-item')?.classList.add('drag-over');
}

function onCatDragLeave(e) {
  e.target.closest('.cat-item')?.classList.remove('drag-over');
}

function onCatDrop(e, ci) {
  e.preventDefault();
  if (dragSrcCat === null || dragSrcCat === ci) return;
  const moved = categories.splice(dragSrcCat, 1)[0];
  categories.splice(ci, 0, moved);
  saveCategories(); render();
}

function onCatDragEnd(e) {
  dragSrcCat = null;
  document.querySelectorAll('.cat-item').forEach(c => {
    c.classList.remove('dragging', 'drag-over');
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

render();

// ─── Notes (Supabase) ────────────────────────────────────────────────────────

const db = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

const notesMap = {};
let showResolved = false;

function relTime(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function renderActivity(events) {
  if (!events || !events.length) return '';
  const latest = {};
  events.forEach(e => {
    const prev = latest[e.recipient];
    if (!prev || new Date(e.created_at) > new Date(prev.created_at)) latest[e.recipient] = e;
  });
  const items = Object.values(latest).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return `<div class="note-activity">
    <div class="activity-label">Activity</div>
    ${items.map(e => `
      <div class="activity-item">
        <span class="activity-dot activity-${e.event_type}"></span>
        <span class="activity-recipient">${escHtml(e.recipient)}</span>
        <span class="activity-badge activity-${e.event_type}">${e.event_type}</span>
        <span class="activity-time">${relTime(e.created_at)}</span>
      </div>`).join('')}
  </div>`;
}

function renderNoteCard(note, events) {
  const actionBtn = note.resolved
    ? `<button class="btn-resolve" onclick="reopenNote('${note.id}')">Reopen</button>`
    : `<button class="btn-resolve" onclick="resolveNote('${note.id}')">Mark resolved</button>`;
  return `<div class="note-card ${note.resolved ? 'resolved' : ''}">
    <div class="note-card-header">
      <span class="note-card-title">${escHtml(note.title)}</span>
      <span class="note-card-time">${new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
    </div>
    <p class="note-card-body">${escHtml(note.body)}</p>
    <div class="note-card-actions">
      <button class="btn-share" onclick="shareNote('${note.id}')">Share via email</button>
      ${actionBtn}
    </div>
    ${renderActivity(events)}
  </div>`;
}

async function loadNotes() {
  const list = document.getElementById('notes-list');
  if (!db) {
    list.innerHTML = '<p class="notes-empty">Notes unavailable — Supabase not configured.</p>';
    return;
  }
  const { data: notes, error } = await db.from('notes').select('*').order('created_at', { ascending: false });
  if (error) { list.innerHTML = '<p class="notes-empty">Failed to load notes.</p>'; return; }

  notes.forEach(n => { notesMap[n.id] = n; });

  const resolvedCount = notes.filter(n => n.resolved).length;
  const visibleNotes = showResolved ? notes : notes.filter(n => !n.resolved);
  updateResolvedToggle(resolvedCount);

  if (!visibleNotes.length) {
    list.innerHTML = notes.length
      ? '<p class="notes-empty">No open notes. All caught up.</p>'
      : '<p class="notes-empty">No notes yet. Be the first to post one.</p>';
    return;
  }

  const eventsMap = {};
  const { data: events } = await db
    .from('email_events')
    .select('*')
    .in('note_id', visibleNotes.map(n => n.id))
    .order('created_at', { ascending: false });
  if (events) events.forEach(e => {
    if (!eventsMap[e.note_id]) eventsMap[e.note_id] = [];
    eventsMap[e.note_id].push(e);
  });

  list.innerHTML = visibleNotes.map(n => renderNoteCard(n, eventsMap[n.id] || [])).join('');
}

function updateResolvedToggle(count) {
  const btn = document.getElementById('notes-resolved-toggle');
  if (!btn) return;
  if (count === 0) { btn.classList.add('hidden'); return; }
  btn.classList.remove('hidden');
  btn.textContent = showResolved ? `Hide resolved (${count})` : `Show resolved (${count})`;
}

function toggleResolved() {
  showResolved = !showResolved;
  loadNotes();
}

async function resolveNote(id) {
  if (!db) return;
  const { error } = await db.from('notes').update({ resolved: true }).eq('id', id);
  if (error) { alert('Failed to resolve note.'); return; }
  await loadNotes();
}

async function reopenNote(id) {
  if (!db) return;
  const { error } = await db.from('notes').update({ resolved: false }).eq('id', id);
  if (error) { alert('Failed to reopen note.'); return; }
  await loadNotes();
}

async function shareNote(id) {
  const note = notesMap[id];
  if (!note) return;
  const to = prompt('Recipient email address:');
  if (to === null) return;
  if (!to.includes('@')) { alert('Please enter a valid email address.'); return; }
  const btn = document.querySelector(`button[onclick="shareNote('${id}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, title: note.title, body: note.body, noteId: note.id, siteUrl: window.location.origin }),
    });
    const data = await res.json();
    if (res.ok) {
      await loadNotes();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Share via email'; }
      alert(`Could not send: ${data.error || 'Unknown error'}`);
    }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = 'Share via email'; }
    alert('Failed to send email. Please try again.');
  }
}

document.getElementById('note-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) return;
  const titleEl = document.getElementById('note-title-input');
  const bodyEl  = document.getElementById('note-body-input');
  const title   = titleEl.value.trim();
  const body    = bodyEl.value.trim();
  if (!title || !body) return;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Posting…';
  const { error } = await db.from('notes').insert({ title, body });
  btn.disabled = false;
  btn.textContent = 'Post Note';
  if (error) { alert('Failed to post note.'); return; }
  titleEl.value = '';
  bodyEl.value  = '';
  await loadNotes();
});

loadNotes();
