# Manual de CanastaClara

Actualizado: 26 de noviembre de 2026. Contribuciones a Open Food Facts mediante enlace externo; reportes ciudadanos locales.

## Uso de la aplicación
CanastaClara consulta productos de Open Food Facts y registros públicos del INVIMA, presenta referencias oficiales y permite registrar observaciones locales. No es una autoridad sanitaria ni reemplaza una consulta médica, legal o de la autoridad.

La app es una SPA con rutas por hash: inicio (`#/` o `#`), búsqueda (`#/buscar`), ficha de producto (`#/producto/CODIGO`), componentes (`#/componentes/CLAVE`), empresas (`#/empresas`), comparar (`#/comparar`), noticias (`#/noticias`) y reportar (`#/reportar`).

### Buscar y consultar un producto
Busca nombre, marca o código de barras. Si escribes un código de 8–13 dígitos puro, se abre directamente la ficha del producto. En los resultados puedes filtrar con chips: "Solo Colombia" (ON registra el producto como país de venta, no que se fabricó allí), Nutri-Score (A–E) y grupo NOVA (1 o 4). Los resultados se paginan; la vista indica cuántos hay en página y el total reportado por la fuente. Las imágenes y datos pueden estar incompletos.

### Ficha de producto
La ficha muestra: nutrientes por 100 g/ml con barras de nivel frente a umbrales de referencia; sellos frontales estimados según umbrales aproximados de la Resolución 2492 de 2022 (cálculo orientativo a partir de los nutrientes reportados; el sello oficial lo define el fabricante); aditivos detectados con enlace a su ficha de componente; lista de ingredientes con enlaces de búsqueda de evidencia (los estudios o revisiones abiertas no confirman un riesgo del producto comercial); un panel "UE frente a Colombia" con las referencias documentales de cada componente; coincidencias INVIMA por marca o titular (una coincidencia por marca no acredita el registro exacto del producto o lote); antecedentes del titular; Nutri-Score/NOVA y una insignia si el producto fue reportado en Colombia. Nutri-Score/NOVA y los cálculos educativos no son una autorización de la UE ni del INVIMA.

### Componentes
Las fichas de componente (aditivos E/INS) presentan referencias oficiales extraídas de fuentes: las referencias EFSA se identifican como UE y se muestran con título y enlace; el documento colombiano se identifica como marco general de Colombia, no como autorización individual del aditivo. Donde no hay referencia específica se informa; nunca se inventa un pronunciamiento conjunto. Los extractos son texto de la fuente, pueden estar en inglés y deben leerse con su contexto. El catálogo de componentes no muestra puntuaciones ni filtros de riesgo editoriales; los nombres/códigos son identificadores y solo las referencias extraídas de una fuente oficial se presentan como tales.

### Empresas
La vista de empresas cruza la marca o titular con los establecimientos vigilados por el INVIMA: concepto sanitario vigente, registros vigentes/vencidos/cancelados y una calificación de vigilancia, con enlaces a los portales oficiales y bases de datos abiertas (datos.gov.co).

### Comparar
El comparador permite buscar dos productos por nombre o código (también se puede enviar uno desde su ficha con "＋ Comparar"). Muestra una tabla nutriente a nutriente con etiqueta "MEJOR" por fila, el recuento de sellos frontales estimados, aditivos declarados y grado NOVA, y un **puntaje orientativo propio** con veredicto "MEJOR OPCIÓN". Ese puntaje combina Nutri-Score, NOVA, sellos estimados y aditivos de alta precaución; es una heurística editorial del observatorio, no una evaluación oficial ni asesoría nutricional, y los datos faltantes no significan cero riesgo.

### Noticias y banner
Fuentes: EFSA noticias/publicaciones y listado sectorial INVIMA de Alimentos y bebidas. El portal actual utiliza un enlace con direccion=da, no un select. El servicio descubre ese enlace en la página oficial; descarta búsquedas de texto heredadas y usa el sector de la tarjeta para clasificar, no palabras sueltas del título. La primera página es una selección, no el historial completo. Títulos de fuente se conservan sin reescribir advertencias sanitarias; los encabezados de la app son informativos.
El banner muestra hasta cinco titulares enlazables: primero alertas alimentarias de Colombia por fecha, luego otras publicaciones por fecha; es una regla transparente de prioridad, no una clasificación científica de importancia. Desliza horizontalmente en móvil; toca para abrir el original. Las actualizaciones son automáticas cada 15 minutos mientras se visita la vista/banner, con caché del servidor; no hay botón manual ni tiempo real garantizado. Fecha de consulta y fecha de publicación son distintas. Fallos de red/fuente o cambios de formato se muestran como actualización pendiente y no como "sin alertas".

### Reportar: registro local y enlace a Open Food Facts
El formulario ciudadano conserva producto, empresa, tipo de hallazgo, gravedad percibida, descripción y evidencia opcional (GTIN, lote, fecha de observación no futura, lugar, enlace HTTPS público). Valida GTIN, fechas y límites de longitud; no incluyas datos personales. Los reportes se guardan solo en localStorage de este navegador; máximo 100. Exporta JSON antes de limpiar el navegador. Los enlaces de evidencia no se descargan ni se suben fotos. Las denuncias formales se realizan ante INVIMA/SIC.

La sección "Contribuir en Open Food Facts" ofrece un enlace directo a https://world.openfoodfacts.org/ que abre su aplicación web en otra pestaña. Allí puedes iniciar sesión con tu propia cuenta para añadir o corregir productos conforme a sus condiciones. CanastaClara no comparte ni transfiere automáticamente los reportes locales.

## Open Food Facts: consulta y contribución externa
Se ha eliminado la funcionalidad de POST, prevalidación y publicación a Open Food Facts, incluidos su endpoint, formulario y adaptador de escritura. CanastaClara conserva únicamente las consultas de productos/búsqueda y enlaces externos. No hay un modo pendiente de activar ni credenciales que configurar para publicar desde CanastaClara.

No pongas usuario o contraseña de Open Food Facts en el código, en CanastaClara ni en el chat. Si antes configuraste variables para la integración retirada, esta versión ya no las utiliza; su eliminación de Vercel no forma parte de este cambio. Las cuentas y la edición externa se gestionan directamente en Open Food Facts.

## Tema y privacidad
El botón Claro/Oscuro guarda la preferencia local (persistente entre pestañas y visitas); la primera visita sigue al sistema operativo. Los reportes y la preferencia de tema se guardan localmente. El identificador del flujo retirado deja de generarse o utilizarse; puede permanecer en el almacenamiento de navegadores que probaron versiones anteriores. Speed Insights usa URL sin consulta ni fragmento; no se envían estos campos de reporte en el URL de telemetría. Los enlaces externos abren otro servicio con su política de privacidad.

## Verificaciones y errores
Desde src: npm ci; node --test tests/*.test.cjs. Verificación de APIs de consulta: BASE_URL=https://deployment node js/test-backend.mjs. Verificación de fuentes: /tests/official-live. La suite de contribución fue retirada junto con la función; /tests/retirement-live comprueba que GET y POST al antiguo endpoint responden 404 y que el enlace externo y el manual están disponibles.

Las pruebas locales comprueban que los archivos de escritura ya no existen, que la interfaz no carga el módulo retirado, que el enlace usa HTTPS y rel seguro y que el manual no invita a configurar publicación. Se mantienen pruebas de reportes locales, fuentes oficiales, sanitización, GTIN, fechas, porcentajes y temas. No se realizan POST a Open Food Facts ni pruebas de credenciales.

Datos remotos se tratan como no confiables: texto escapado, destinos fijos, sin redirects, tamaño/tiempo limitados y XML con entidades rechazado. Los fallos remotos muestran su estado, sin inventar ausencia de alertas. La seguridad no es absoluta ni una auditoría completa.

## Mantenimiento y respaldo
El proyecto aún no tiene GitHub conectado. Conservar el archivo de fuente entregado, el lockfile y este manual. Desplegar src como raíz. Cambios de esquema de INVIMA/EFSA requieren actualizar parsers y fixtures, verificar lecturas vivas y preview móvil/escritorio antes de producción. No basta un deployment READY para demostrar funcionamiento de un proveedor.
