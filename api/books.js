/* =========================================================
   Biblioteca Municipal — /api/books.js
   Vercel Serverless Function

   Variables de entorno requeridas en Vercel:
     DATABASE_URL   → Connection string de Neon PostgreSQL
     ADMIN_USER     → Nombre de usuario del administrador
     ADMIN_PASSWORD → Contraseña del administrador
     JWT_SECRET     → Clave secreta para firmar tokens JWT

   Métodos soportados:
     GET    /api/books          → Listar todos los libros
     GET    /api/books?id=N     → Obtener un libro por ID
     POST   /api/books          → Crear libro  (requiere auth)
     POST   /api/books          → Login        (header X-Action: login)
     POST   /api/books          → Guardar contacto (header X-Action: contact)
     PUT    /api/books?id=N     → Actualizar libro (requiere auth)
     DELETE /api/books?id=N     → Eliminar libro   (requiere auth)
   ========================================================= */

const { neon } = require('@neondatabase/serverless');

/* ---------- Helper: respuesta JSON ---------- */
function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(status).json(data);
}

/* ---------- Helper: error ---------- */
function err(res, status, message) {
  return json(res, status, { error: message });
}

/* ---------- JWT simple (sin librería externa) ---------- */
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function signJwt(payload) {
  const secret  = process.env.JWT_SECRET || 'dev_secret_change_me';
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig     = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  try {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const [header, body, sig] = token.split('.');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    // Token válido por 8 horas
    if (Date.now() / 1000 - payload.iat > 28800) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- Middleware: verificar auth ---------- */
function requireAuth(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.replace('Bearer ', '').trim();
  if (!token) { err(res, 401, 'No autorizado'); return false; }
  const payload = verifyJwt(token);
  if (!payload) { err(res, 401, 'Token inválido o expirado'); return false; }
  return true;
}

/* =========================================================
   HANDLER PRINCIPAL
   ========================================================= */
module.exports = async function handler(req, res) {

  /* CORS preflight */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Action');
    return res.status(204).end();
  }

  /* Conexión a Neon */
  const sql = neon(process.env.DATABASE_URL);

  const { method } = req;
  const action     = req.headers['x-action'] || '';
  const id         = req.query?.id ? parseInt(req.query.id, 10) : null;

  /* -------------------------------------------------------
     POST → LOGIN
  ------------------------------------------------------- */
  if (method === 'POST' && action === 'login') {
    const { usuario, password } = req.body || {};

    const expectedUser = process.env.ADMIN_USER     || 'admin';
    const expectedPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (usuario !== expectedUser || password !== expectedPass) {
      return err(res, 401, 'Credenciales incorrectas');
    }

    const token = signJwt({ sub: usuario, role: 'admin' });
    return json(res, 200, { token });
  }

  /* -------------------------------------------------------
     POST → GUARDAR CONTACTO (público)
  ------------------------------------------------------- */
  if (method === 'POST' && action === 'contact') {
    const { nombre, email, telefono, mensaje, libro_id } = req.body || {};

    if (!nombre || !email || !mensaje) {
      return err(res, 400, 'Faltan campos obligatorios');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err(res, 400, 'Email inválido');
    }

    try {
      // Guardar consulta de contacto
      await sql`
        INSERT INTO consultas (nombre, email, telefono, mensaje)
        VALUES (${nombre}, ${email}, ${telefono || null}, ${mensaje})
      `;

      // Si viene un libro_id, registrar la reserva
      if (libro_id) {
        const libroIdNum = parseInt(libro_id, 10);
        if (!isNaN(libroIdNum)) {
          await sql`
            INSERT INTO reservas (nombre, email, telefono, libro_id)
            VALUES (${nombre}, ${email}, ${telefono || null}, ${libroIdNum})
          `;
        }
      }

      return json(res, 201, { ok: true });
    } catch (e) {
      console.error('Error guardando consulta:', e);
      return err(res, 500, 'Error interno del servidor');
    }
  }

  /* -------------------------------------------------------
     GET → LISTAR LIBROS (público)
  ------------------------------------------------------- */
  if (method === 'GET' && !id) {
    try {
      const books = await sql`SELECT * FROM libros ORDER BY id ASC`;
      return json(res, 200, { books });
    } catch (e) {
      console.error('Error listando libros:', e);
      return err(res, 500, 'Error interno del servidor');
    }
  }

  /* -------------------------------------------------------
     GET → OBTENER UN LIBRO POR ID (público)
  ------------------------------------------------------- */
  if (method === 'GET' && id) {
    try {
      const rows = await sql`SELECT * FROM libros WHERE id = ${id}`;
      if (rows.length === 0) return err(res, 404, 'Libro no encontrado');
      return json(res, 200, { book: rows[0] });
    } catch (e) {
      console.error('Error obteniendo libro:', e);
      return err(res, 500, 'Error interno del servidor');
    }
  }

  /* -------------------------------------------------------
     POST → CREAR LIBRO (requiere auth)
  ------------------------------------------------------- */
  if (method === 'POST') {
    if (!requireAuth(req, res)) return;

    const { titulo, autor, categoria, imagen, disponible } = req.body || {};

    if (!titulo || !autor || !categoria) {
      return err(res, 400, 'Faltan campos obligatorios: titulo, autor, categoria');
    }

    try {
      const rows = await sql`
        INSERT INTO libros (titulo, autor, categoria, imagen, disponible)
        VALUES (${titulo}, ${autor}, ${categoria}, ${imagen || null}, ${disponible !== false})
        RETURNING *
      `;
      return json(res, 201, { book: rows[0] });
    } catch (e) {
      console.error('Error creando libro:', e);
      return err(res, 500, 'Error interno del servidor');
    }
  }

  /* -------------------------------------------------------
     PUT → ACTUALIZAR LIBRO (requiere auth)
  ------------------------------------------------------- */
  if (method === 'PUT') {
    if (!requireAuth(req, res)) return;
    if (!id) return err(res, 400, 'Se requiere el parámetro id');

    const { titulo, autor, categoria, imagen, disponible } = req.body || {};

    if (!titulo || !autor || !categoria) {
      return err(res, 400, 'Faltan campos obligatorios: titulo, autor, categoria');
    }

    try {
      const rows = await sql`
        UPDATE libros
        SET titulo     = ${titulo},
            autor      = ${autor},
            categoria  = ${categoria},
            imagen     = ${imagen || null},
            disponible = ${disponible !== false},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) return err(res, 404, 'Libro no encontrado');
      return json(res, 200, { book: rows[0] });
    } catch (e) {
      console.error('Error actualizando libro:', e);
      return err(res, 500, 'Error interno del servidor');
    }
  }

  /* -------------------------------------------------------
     DELETE → ELIMINAR LIBRO (requiere auth)
  ------------------------------------------------------- */
  if (method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    if (!id) return err(res, 400, 'Se requiere el parámetro id');

    try {
      const rows = await sql`DELETE FROM libros WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return err(res, 404, 'Libro no encontrado');
      return json(res, 200, { deleted: id });
    } catch (e) {
      console.error('Error eliminando libro:', e);
      return err(res, 500, 'Error interno del servidor');
    }
  }

  /* Método no soportado */
  return err(res, 405, 'Método no permitido');
};