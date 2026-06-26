/* =========================================================
   Biblioteca Municipal — script.js
   Toda la interacción del frontend. Consume /api/books.js
   ========================================================= */

'use strict';

/* ---------- Imágenes de libros (Pexels, libres de derechos) ---------- */
const BOOK_IMAGES = {
  'Novela':   'https://images.pexels.com/photos/1907785/pexels-photo-1907785.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Ensayo':   'https://images.pexels.com/photos/256431/pexels-photo-256431.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Ciencia':  'https://images.pexels.com/photos/2280571/pexels-photo-2280571.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Infantil': 'https://images.pexels.com/photos/3662667/pexels-photo-3662667.jpeg?auto=compress&cs=tinysrgb&w=600',
  'default':  'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=600',
};

/* ---------- Estado local del catálogo ---------- */
let allBooks      = [];
let searchQuery   = '';
let selectedCat   = 'Todos';

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initFaq();
  initContactForm();
  loadCatalog();
});

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
function initNav() {
  const toggle     = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  if (!toggle || !mobileMenu) return;

  toggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
    mobileMenu.setAttribute('aria-hidden', !isOpen);
  });

  // Cerrar al hacer click en un link del menú móvil
  mobileMenu.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
    });
  });
}

/* =========================================================
   FAQ ACORDEÓN
   ========================================================= */
function initFaq() {
  document.querySelectorAll('.faq-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer   = btn.nextElementSibling;
      const isOpen   = answer.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
    });
  });
}

/* =========================================================
   CATÁLOGO — carga desde la API
   ========================================================= */
async function loadCatalog() {
  try {
    const res  = await fetch('/api/books');
    const data = await res.json();
    allBooks   = data.books || [];
  } catch {
    // Si la API no está disponible (dev local sin backend), usar datos de muestra
    allBooks = getFallbackBooks();
  }

  renderCategories();
  renderCatalog();

  // Buscador
  const searchInput = document.getElementById('catalog-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderCatalog();
    });
  }
}

function renderCategories() {
  const cats      = ['Todos', ...new Set(allBooks.map(b => b.categoria))].filter(Boolean);
  const container = document.getElementById('catalog-categories');
  if (!container) return;

  container.innerHTML = cats.map(cat => `
    <button class="category-btn${selectedCat === cat ? ' active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');

  container.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCat = btn.dataset.cat;
      renderCategories();
      renderCatalog();
    });
  });
}

function renderCatalog() {
  const term    = searchQuery.trim().toLowerCase();
  const results = allBooks.filter(b => {
    const matchCat  = selectedCat === 'Todos' || b.categoria === selectedCat;
    const matchTerm = !term
      || (b.titulo  || '').toLowerCase().includes(term)
      || (b.autor   || '').toLowerCase().includes(term)
      || (b.categoria || '').toLowerCase().includes(term);
    return matchCat && matchTerm;
  });

  const numEl   = document.getElementById('results-num');
  const emptyEl = document.getElementById('catalog-empty');
  const grid    = document.getElementById('catalog-grid');

  if (numEl)   numEl.textContent = results.length;
  if (emptyEl) emptyEl.classList.toggle('hidden', results.length > 0);
  if (!grid)   return;

  grid.innerHTML = results.map(b => {
    const img       = b.imagen || BOOK_IMAGES[b.categoria] || BOOK_IMAGES['default'];
    const available = b.disponible !== false && b.disponible !== 0;
    return `
      <article class="book-card">
        <div class="book-cover">
          <img src="${escHtml(img)}" alt="Portada de ${escHtml(b.titulo)}" loading="lazy">
          <span class="book-badge ${available ? 'badge-available' : 'badge-unavailable'}">
            ${available ? 'Disponible' : 'Prestado'}
          </span>
        </div>
        <div class="book-body">
          <div class="book-category">${escHtml(b.categoria || '')}</div>
          <h3 class="book-title">${escHtml(b.titulo)}</h3>
          <p class="book-author">${escHtml(b.autor || '')}</p>
          <button
            class="book-btn ${available ? 'book-btn-available' : 'book-btn-unavailable'}"
            ${available ? '' : 'disabled'}
            aria-label="${available ? 'Reservar ' + b.titulo : 'No disponible'}"
          >
            ${available ? 'Reservar' : 'En espera'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

/* =========================================================
   FORMULARIO DE CONTACTO
   ========================================================= */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const successEl = document.getElementById('form-success');
    const errorEl   = document.getElementById('form-error');
    const submitBtn = document.getElementById('form-submit');

    successEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');

    if (!validateContactForm(form)) return;

    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Enviando...';
    }

    try {
      const payload = {
        nombre:   form.querySelector('#contact-name')?.value.trim(),
        email:    form.querySelector('#contact-email')?.value.trim(),
        telefono: form.querySelector('#contact-phone')?.value.trim(),
        mensaje:  form.querySelector('#contact-msg')?.value.trim(),
      };

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Action': 'contact' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        successEl?.classList.remove('hidden');
        form.reset();
      } else {
        throw new Error('Error del servidor');
      }
    } catch {
      errorEl?.classList.remove('hidden');
    } finally {
      if (submitBtn) {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Enviar Mensaje';
      }
    }
  });
}

function validateContactForm(form) {
  let valid = true;
  const fields = ['contact-name', 'contact-email', 'contact-msg'];
  fields.forEach(id => {
    const el = form.querySelector('#' + id);
    if (!el) return;
    const empty = !el.value.trim();
    const emailBad = id === 'contact-email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
    if (empty || emailBad) {
      el.classList.add('invalid');
      valid = false;
    } else {
      el.classList.remove('invalid');
    }
  });
  return valid;
}

/* =========================================================
   DATOS DE MUESTRA (fallback sin backend)
   ========================================================= */
function getFallbackBooks() {
  return [
    { id: 1, titulo: 'Cien años de soledad',             autor: 'Gabriel García Márquez',   categoria: 'Novela',   disponible: true },
    { id: 2, titulo: 'La sombra del viento',             autor: 'Carlos Ruiz Zafón',        categoria: 'Novela',   disponible: false },
    { id: 3, titulo: 'Rayuela',                          autor: 'Julio Cortázar',            categoria: 'Novela',   disponible: true },
    { id: 4, titulo: 'Breve historia del tiempo',        autor: 'Stephen Hawking',           categoria: 'Ciencia',  disponible: true },
    { id: 5, titulo: 'Sapiens',                          autor: 'Yuval Noah Harari',         categoria: 'Ensayo',   disponible: true },
    { id: 6, titulo: 'El Principito',                    autor: 'Antoine de Saint-Exupéry',  categoria: 'Infantil', disponible: true },
    { id: 7, titulo: '1984',                             autor: 'George Orwell',             categoria: 'Novela',   disponible: false },
    { id: 8, titulo: 'Crónica de una muerte anunciada',  autor: 'Gabriel García Márquez',   categoria: 'Novela',   disponible: true },
    { id: 9, titulo: 'El amor en los tiempos del cólera',autor: 'Gabriel García Márquez',   categoria: 'Novela',   disponible: true },
    { id:10, titulo: 'Pedagogía del oprimido',           autor: 'Paulo Freire',              categoria: 'Ensayo',   disponible: true },
    { id:11, titulo: 'Astrofísica para apurados',        autor: 'Neil deGrasse Tyson',       categoria: 'Ciencia',  disponible: true },
    { id:12, titulo: 'Donde viven los monstruos',        autor: 'Maurice Sendak',            categoria: 'Infantil', disponible: true },
  ];
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
