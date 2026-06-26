-- =============================================================
--  Biblioteca Municipal — Script SQL para Neon PostgreSQL
--  Diseño lógico: tablas, claves primarias, foráneas,
--  restricciones, relaciones y datos de prueba.
-- =============================================================


-- -------------------------------------------------------------
-- TABLA: libros
--   Catálogo principal de la biblioteca.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS libros (
    id          SERIAL          PRIMARY KEY,
    titulo      VARCHAR(300)    NOT NULL,
    autor       VARCHAR(200)    NOT NULL,
    categoria   VARCHAR(100)    NOT NULL,
    imagen      TEXT,                         -- URL de la imagen de portada (opcional)
    disponible  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_titulo    CHECK (LENGTH(TRIM(titulo))    > 0),
    CONSTRAINT chk_autor     CHECK (LENGTH(TRIM(autor))     > 0),
    CONSTRAINT chk_categoria CHECK (LENGTH(TRIM(categoria)) > 0)
);

COMMENT ON TABLE  libros IS 'Catálogo de libros de la Biblioteca Municipal';
COMMENT ON COLUMN libros.disponible IS 'TRUE = disponible para préstamo; FALSE = prestado';


-- -------------------------------------------------------------
-- TABLA: consultas
--   Mensajes recibidos desde el formulario de contacto.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultas (
    id          SERIAL          PRIMARY KEY,
    nombre      VARCHAR(200)    NOT NULL,
    email       VARCHAR(254)    NOT NULL,
    telefono    VARCHAR(30),
    mensaje     TEXT            NOT NULL,
    leida       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_nombre   CHECK (LENGTH(TRIM(nombre))  > 0),
    CONSTRAINT chk_email    CHECK (email LIKE '%@%.%'),
    CONSTRAINT chk_mensaje  CHECK (LENGTH(TRIM(mensaje)) > 0)
);

COMMENT ON TABLE  consultas IS 'Mensajes del formulario de contacto del sitio web';
COMMENT ON COLUMN consultas.leida IS 'TRUE = el administrador ya leyó este mensaje';


-- -------------------------------------------------------------
-- ÍNDICES
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_libros_categoria   ON libros (categoria);
CREATE INDEX IF NOT EXISTS idx_libros_disponible  ON libros (disponible);
CREATE INDEX IF NOT EXISTS idx_consultas_leida    ON consultas (leida);
CREATE INDEX IF NOT EXISTS idx_consultas_created  ON consultas (created_at DESC);


-- =============================================================
--  DATOS DE PRUEBA
-- =============================================================

INSERT INTO libros (titulo, autor, categoria, disponible) VALUES
    ('Cien años de soledad',              'Gabriel García Márquez',   'Novela',   TRUE),
    ('La sombra del viento',              'Carlos Ruiz Zafón',        'Novela',   FALSE),
    ('Rayuela',                           'Julio Cortázar',           'Novela',   TRUE),
    ('Breve historia del tiempo',         'Stephen Hawking',          'Ciencia',  TRUE),
    ('Sapiens',                           'Yuval Noah Harari',        'Ensayo',   TRUE),
    ('El Principito',                     'Antoine de Saint-Exupéry', 'Infantil', TRUE),
    ('1984',                              'George Orwell',            'Novela',   FALSE),
    ('Crónica de una muerte anunciada',   'Gabriel García Márquez',   'Novela',   TRUE),
    ('El amor en los tiempos del cólera', 'Gabriel García Márquez',   'Novela',   TRUE),
    ('Pedagogía del oprimido',            'Paulo Freire',             'Ensayo',   TRUE),
    ('Astrofísica para apurados',         'Neil deGrasse Tyson',      'Ciencia',  TRUE),
    ('Donde viven los monstruos',         'Maurice Sendak',           'Infantil', TRUE)
ON CONFLICT DO NOTHING;


INSERT INTO consultas (nombre, email, telefono, mensaje) VALUES
    ('María González', 'maria@ejemplo.com', '+54 9 370 1234567', 'Quisiera saber si tienen el libro "Don Quijote" disponible.'),
    ('Carlos Pérez',   'carlos@ejemplo.com', NULL,              'Me gustaría inscribir a mi hijo en el taller de lectura infantil.')
ON CONFLICT DO NOTHING;


-- =============================================================
--  VISTAS ÚTILES (opcionales, para el informe y consultas)
-- =============================================================

-- Libros disponibles
CREATE OR REPLACE VIEW v_libros_disponibles AS
    SELECT id, titulo, autor, categoria
    FROM   libros
    WHERE  disponible = TRUE
    ORDER  BY titulo;

-- Resumen por categoría
CREATE OR REPLACE VIEW v_resumen_categorias AS
    SELECT
        categoria,
        COUNT(*)                                       AS total,
        COUNT(*) FILTER (WHERE disponible = TRUE)      AS disponibles,
        COUNT(*) FILTER (WHERE disponible = FALSE)     AS prestados
    FROM  libros
    GROUP BY categoria
    ORDER BY categoria;

-- Consultas no leídas
CREATE OR REPLACE VIEW v_consultas_pendientes AS
    SELECT id, nombre, email, LEFT(mensaje, 80) AS resumen, created_at
    FROM   consultas
    WHERE  leida = FALSE
    ORDER  BY created_at DESC;


-- =============================================================
--  CONSULTAS DE EJEMPLO (para el informe técnico)
-- =============================================================

-- Ver todos los libros:
-- SELECT * FROM libros ORDER BY titulo;

-- Ver libros disponibles por categoría:
-- SELECT * FROM v_resumen_categorias;

-- Ver consultas sin leer:
-- SELECT * FROM v_consultas_pendientes;

-- Buscar libros de un autor:
-- SELECT titulo, categoria, disponible FROM libros WHERE autor ILIKE '%García Márquez%';

-- Marcar consulta como leída:
-- UPDATE consultas SET leida = TRUE WHERE id = 1;
