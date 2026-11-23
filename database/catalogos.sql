-- Postedin Guard: datos de los catálogos (los mismos que carga prisma/seed.ts).

INSERT INTO rol (nombre, descripcion) VALUES ('LIDER_TECNICO', 'Administra repositorios, políticas, usuarios y asigna hallazgos');
INSERT INTO rol (nombre, descripcion) VALUES ('DESARROLLADOR', 'Atiende hallazgos asignados y completa el checklist de revisión IA');

INSERT INTO severidad (nombre, nivel, plazo_dias) VALUES ('Crítica', 4, 2);
INSERT INTO severidad (nombre, nivel, plazo_dias) VALUES ('Alta', 3, 7);
INSERT INTO severidad (nombre, nivel, plazo_dias) VALUES ('Media', 2, 30);
INSERT INTO severidad (nombre, nivel, plazo_dias) VALUES ('Baja', 1, 90);

INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Secreto expuesto', 'Credenciales, tokens o llaves en el código o historial', 'A07:2021');
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Dependencia vulnerable', 'Librería con vulnerabilidad conocida u obsoleta', 'A06:2021');
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Permisos de API', 'Endpoint sin autenticación o control de acceso por rol', 'API5:2023');
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Gestión de sesiones', 'Cookies, expiración o revocación de sesiones inseguras', 'A07:2021');
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Código inseguro', 'Patrones inseguros detectados por análisis estático', 'A03:2021');
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Migraciones', 'Cambios de esquema fuera del proceso de migraciones', NULL);
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Calidad y pruebas', 'Pruebas fallidas o cobertura bajo el umbral', NULL);
INSERT INTO categoria_hallazgo (nombre, descripcion, referencia_owasp) VALUES ('Documentación', 'Comentarios redundantes o documentación desalineada con el código', NULL);

INSERT INTO herramienta (nombre, tipo_analisis, version) VALUES ('gitleaks', 'Secretos', '8.x');
INSERT INTO herramienta (nombre, tipo_analisis, version) VALUES ('npm audit', 'Dependencias', '11.x');
INSERT INTO herramienta (nombre, tipo_analisis, version) VALUES ('Semgrep', 'SAST', '1.x');
INSERT INTO herramienta (nombre, tipo_analisis, version) VALUES ('Vitest', 'Pruebas', '4.x');

INSERT INTO item_checklist (pregunta, orden) VALUES ('¿El código generado por IA evita incluir secretos, tokens o credenciales?', 1);
INSERT INTO item_checklist (pregunta, orden) VALUES ('¿Se validan las entradas del usuario y los permisos en cada endpoint nuevo?', 2);
INSERT INTO item_checklist (pregunta, orden) VALUES ('¿Las dependencias agregadas por sugerencia de la IA son necesarias, vigentes y sin vulnerabilidades?', 3);
INSERT INTO item_checklist (pregunta, orden) VALUES ('¿Los cambios de base de datos se realizaron mediante migraciones versionadas?', 4);
INSERT INTO item_checklist (pregunta, orden) VALUES ('¿Se agregaron o actualizaron pruebas automatizadas para el cambio?', 5);
INSERT INTO item_checklist (pregunta, orden) VALUES ('¿Se eliminaron comentarios redundantes y la documentación se limita a decisiones de producto?', 6);
