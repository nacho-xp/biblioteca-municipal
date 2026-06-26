/* =========================================================
   Biblioteca Municipal — admin.js
   Lógica del panel administrativo. Consume /api/books.js
   ========================================================= */

'use strict';

/* ---------- Estado ---------- */
let authToken    = sessionStorage.getItem('bm_token') || null;
let deleteTarget = null;

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    showPanel();
  } else {
    showLogin();
  }

  // Login
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Agregar libro
  document.getElementById('add-book-btn').addEventListener('click', () => openModal());

  // Modal libro
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', handleSaveBook);
  document.getElementById('book-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Modal eliminar
  document.getElementById('delete-cancel').addEventListener('click',  closeDeleteModal);
  document.getElementById('delete-confirm').addEventListener('click', handleDeleteBook);
  document.getElementById('delete-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });
});

/* =========================================================
   AUTENTICACIÓN
   ========================================================= */
async function handleLogin() {
  const user    = document.getElementById('login-user').value.trim();
  const pass    = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  const btn     = document.getElementById('login-btn');

  errorEl.classList.add('hidden');

  if (!user || !pass) {
    errorEl.textContent = 'Ingresá usuario y contraseña.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Ingresando...';

  try {
    const res  = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Action': 'login' },
      body: JSON.stringify({ usuario: user, password: pass }),
    });
    const data = await res.json();

    if (res.ok && data.token) {
      authToken = data.token;
      sessionStorage.setItem('bm_token', authToken);
      showPanel();
    } else {
      errorEl.textContent = 'Usuario o contraseña incorrectos.';
      errorEl.classList.remove('hidden');
    }
  } catch {
    errorEl.textContent = 'Error de conexión. Intentá nuevamente.';
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Ingresar';
  }
}

function handleLogout() {
  authToken = null;
  sessionStorage.removeItem('bm_token');
  showLogin();
}

/* =========================================================
   MOSTRAR SECCIONES
   ========================================================= */
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-panel').classList.add('hidden');
}

function showPanel() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  loadBooks();
}

/* =========================================================
   CRUD LIBROS
   ========================================================= */

/* ----- GET ----- */
async function loadBooks() {
  const loader    = document.getElementById('table-loader');
  const emptyEl   = document.getElementById('table-empty');
  const table     = document.getElementById('books-table');

  loader.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  table.style.display = 'none';

  try {
    const res  = await apiFetch('/api/books');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al cargar');

    const books = data.books || [];
    loader.classList.add('hidden');

    if (books.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    table.style.display = 'table';
    renderTable(books);
  } catch (err) {
    loader.textContent = 'Error al cargar los libros. ' + err.message;
  }
}

function renderTable(books) {
  const tbody = document.getElementById('books-tbody');
  tbody.innerHTML = books.map(b => `
    <tr>
      <td data-label="ID">${b.id}</td>
      <td data-label="Título">${escHtml(b.titulo)}</td>
      <td data-label="Autor">${escHtml(b.autor)}</td>
      <td data-label="Categoría">${escHtml(b.categoria)}</td>
      <td data-label="Estado">
        <span class="status-badge ${b.disponible ? 'status-available' : 'status-unavailable'}">
          ${b.disponible ? 'Disponible' : 'Prestado'}
        </span>
      </td>
      <td data-label="Acciones">
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="openModal(${b.id})">Editar</button>
          <button class="btn btn-danger btn-sm"    onclick="openDeleteModal(${b.id})">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ----- POST (crear) / PUT (editar) ----- */
async function handleSaveBook() {
  const id        = document.getElementById('book-id').value;
  const titulo    = document.getElementById('book-titulo').value.trim();
  const autor     = document.getElementById('book-autor').value.trim();
  const categoria = document.getElementById('book-categoria').value;
  const imagen    = document.getElementById('book-imagen').value.trim();
  const dispVal   = document.getElementById('book-disponible').value;
  const errorEl   = document.getElementById('modal-error');
  const saveBtn   = document.getElementById('modal-save');

  errorEl.classList.add('hidden');

  if (!titulo || !autor || !categoria) {
    errorEl.classList.remove('hidden');
    return;
  }

  const payload = {
    titulo,
    autor,
    categoria,
    imagen: imagen || null,
    disponible: dispVal === 'true',
  };

  saveBtn.disabled    = true;
  saveBtn.textContent = 'Guardando...';

  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/books?id=${id}` : '/api/books';
    const res    = await apiFetch(url, { method, body: JSON.stringify(payload) });
    const data   = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al guardar');

    closeModal();
    showToast(id ? 'Libro actualizado.' : 'Libro agregado.', 'success');
    loadBooks();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Guardar';
  }
}

/* ----- DELETE ----- */
async function handleDeleteBook() {
  if (!deleteTarget) return;

  const btn = document.getElementById('delete-confirm');
  btn.disabled    = true;
  btn.textContent = 'Eliminando...';

  try {
    const res  = await apiFetch(`/api/books?id=${deleteTarget}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al eliminar');

    closeDeleteModal();
    showToast('Libro eliminado.', 'success');
    loadBooks();
  } catch (err) {
    closeDeleteModal();
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Eliminar';
  }
}

/* =========================================================
   MODAL LIBRO — abrir / cerrar
   ========================================================= */
async function openModal(id = null) {
  document.getElementById('modal-title').textContent = id ? 'Editar libro' : 'Agregar libro';
  document.getElementById('modal-error').classList.add('hidden');

  // Limpiar
  document.getElementById('book-id').value         = '';
  document.getElementById('book-titulo').value      = '';
  document.getElementById('book-autor').value       = '';
  document.getElementById('book-categoria').value   = '';
  document.getElementById('book-imagen').value      = '';
  document.getElementById('book-disponible').value  = 'true';

  if (id) {
    try {
      const res  = await apiFetch(`/api/books?id=${id}`);
      const data = await res.json();
      const b    = data.book;

      if (b) {
        document.getElementById('book-id').value        = b.id;
        document.getElementById('book-titulo').value    = b.titulo    || '';
        document.getElementById('book-autor').value     = b.autor     || '';
        document.getElementById('book-categoria').value = b.categoria || '';
        document.getElementById('book-imagen').value    = b.imagen    || '';
        document.getElementById('book-disponible').value = b.disponible ? 'true' : 'false';
      }
    } catch {
      showToast('No se pudo cargar el libro.', 'error');
      return;
    }
  }

  document.getElementById('book-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('book-modal').classList.add('hidden');
}

/* =========================================================
   MODAL ELIMINAR — abrir / cerrar
   ========================================================= */
function openDeleteModal(id) {
  deleteTarget = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  deleteTarget = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

/* =========================================================
   TOAST
   ========================================================= */
let toastTimer = null;

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast toast-${type}`;

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* =========================================================
   API FETCH (con token)
   ========================================================= */
function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken || ''}`,
      ...(options.headers || {}),
    },
  });
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
