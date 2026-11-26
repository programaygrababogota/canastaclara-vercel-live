# Retirada de publicación y prevalidación OFF — 26/11/2026

Se elimina api/off-contribution.js, lib/off-contribution.js, js/contribution.js y sus pruebas/formulario. No quedan rutas públicas ni adaptadores de escritura a OFF en esta versión. Se conserva la lectura de búsqueda/productos, fuentes oficiales y reportes ciudadanos locales con evidencia. En Reportar se añade enlace HTTPS a https://world.openfoodfacts.org/ en pestaña externa con noopener noreferrer. Sin transferencia automática de reportes ni credenciales.

Manual actualizado MANUAL.md y /manual: contribución externa, sin instrucciones de configuración de credenciales ni futura activación. No se eliminaron variables de Vercel ni datos locales de reportes. Identificador obsoleto de contribuyente puede permanecer en navegadores previos, pero ya no se genera ni utiliza. Se entrega también PDF actualizado del manual.

Verificación: 24/24 pruebas locales, sintaxis correcta, preview READY. Listado de archivos del deployment confirma ausencia de endpoint/adaptador/módulo OFF y manual presente. La comprobación visual y las pruebas HTTP de 404 quedaron bloqueadas por Vercel Firewall security challenge (preview_challenged); no se cambió firewall ni se debilitó protección. /tests/retirement-live queda disponible para comprobar 404 de GET/POST antiguos, módulo retirado y manual. No se afirma que estas pruebas HTTP desplegadas hayan pasado. No se ejerció el enlace externo fuera del preview. El código no llama a escrituras OFF.

Preview dpl_D2tAGimhNFs4YHRGLmHM66g9o2TJ, sin metadata Git. Producción creada por promoción dpl_DUAu1Z7oXudPxJaj5X95ENayBt2x. No hay GitHub conectado; fuente entregada en archivo. Ejecutar desde src: node --test tests/*.test.cjs.
