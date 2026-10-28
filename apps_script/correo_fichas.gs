/**
 * CORREOS DE FICHAS TECNICAS - Swantex
 * ------------------------------------------------------------
 * Reemplaza a EmailJS. La aplicacion de fichas llama a este script y el script
 * manda el correo con la cuenta de Google del dueno del script (MailApp).
 *
 * Ventajas sobre EmailJS:
 *   - No se vence el permiso de Gmail (no hay que reconectar nada).
 *   - Sin tope de 200 correos al mes (MailApp permite ~1.500 diarios).
 *   - El texto del correo vive aqui y se cambia sin tocar la aplicacion.
 *
 * INSTALACION (una sola vez): ver instrucciones al final del archivo.
 */

// ===================== CONFIGURACION (edite aqui) =====================
var TOKEN = 'swx-fichas-2026';                 // debe ser igual al GAS_TOKEN de la aplicacion
var REMITENTE = 'Textiles Swantex SAS';        // nombre que ve quien recibe
var COPIA_SIEMPRE = '';                        // correo que recibe copia de todo (deje '' si no quiere)
// ======================================================================

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    if (d.token !== TOKEN) return json_({ ok: false, error: 'Token invalido' });

    var para = (d.to_email || '').trim();
    if (!para) return json_({ ok: false, error: 'Falta el destinatario' });

    var msg = (d.tipo === 'firma') ? correoFirma_(d) : correoAprobacion_(d);
    var opts = { to: para, subject: msg.asunto, htmlBody: msg.html, body: msg.texto, name: REMITENTE };

    var cc = [];
    if (d.correo_copia) cc.push(d.correo_copia);
    if (COPIA_SIEMPRE && COPIA_SIEMPRE !== d.correo_copia) cc.push(COPIA_SIEMPRE);
    cc = cc.filter(function (c) { return para.indexOf(c) < 0; });
    if (cc.length) opts.cc = cc.join(',');
    if (d.correo_copia) opts.replyTo = d.correo_copia;

    MailApp.sendEmail(opts);
    return json_({ ok: true, enviado: para, restantes: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/** Prueba rapida desde el editor: se envia a usted mismo. */
function enviarPrueba() {
  var yo = Session.getEffectiveUser().getEmail();
  var r = doPost({ postData: { contents: JSON.stringify({
    token: TOKEN, tipo: 'aprobacion', to_email: yo,
    nombre_jefatura: 'Nombre de prueba', rol: 'Armado y Calidad',
    producto: 'BODY CONTROL SUAVE · Talla M', lcc: 'LCC-1234', tem: 'TEM-5678',
    link_aprobacion: 'https://dp522-ops.github.io/swantex-fichas/?v=prueba',
    correo_copia: yo
  }) } });
  Logger.log(r.getContent());
}

/** Correo que pide la aprobacion de una ficha. */
function correoAprobacion_(d) {
  var prod = d.producto || '—';
  var varias = /^\d+\s+fichas:/.test(prod);
  var asunto = varias ? ('Fichas técnicas para su aprobación — ' + (d.rol || ''))
                      : ('Ficha técnica para su aprobación: ' + prod);

  var h = cabecera_('FICHA TÉCNICA PARA APROBACIÓN', '#2563eb');
  h += '<p style="font-size:15px;margin:0 0 14px">Hola <b>' + esc_(d.nombre_jefatura || '') + '</b>,</p>';
  h += '<p style="font-size:14px;color:#334155;margin:0 0 16px">Tiene ' + (varias ? 'fichas técnicas pendientes' : 'una ficha técnica pendiente') +
       ' de su revisión y firma como <b>' + esc_(d.rol || '') + '</b>.</p>';
  h += tabla_([['Producto', prod], ['LCC', d.lcc || '—'], ['TEM', d.tem || '—']]);
  h += boton_(d.link_aprobacion, varias ? 'Abrir y aprobar las fichas' : 'Abrir y aprobar la ficha');
  h += '<p style="font-size:12.5px;color:#64748b;margin:18px 0 0">Si el botón no funciona, copie este enlace en el navegador:<br>' +
       '<span style="word-break:break-all;color:#2563eb">' + esc_(d.link_aprobacion || '') + '</span></p>';
  h += pie_();

  var t = 'Hola ' + (d.nombre_jefatura || '') + ',\n\n' +
    'Tiene ' + (varias ? 'fichas tecnicas pendientes' : 'una ficha tecnica pendiente') + ' de su firma como ' + (d.rol || '') + '.\n\n' +
    'Producto: ' + prod + '\nLCC: ' + (d.lcc || '—') + '\nTEM: ' + (d.tem || '—') + '\n\n' +
    'Abrir y aprobar: ' + (d.link_aprobacion || '') + '\n';
  return { asunto: asunto, html: h, texto: t };
}

/** Correo que avisa que alguien ya firmo. */
function correoFirma_(d) {
  var listo = String(d.estado || '').indexOf('LISTA') >= 0;
  var h = cabecera_(listo ? 'FICHA LISTA PARA PDF' : 'NUEVA FIRMA REGISTRADA', listo ? '#059669' : '#d97706');
  h += '<p style="font-size:15px;margin:0 0 14px"><b>' + esc_(d.nombre_firmante || '') + '</b> firmó como <b>' + esc_(d.rol || '') + '</b>.</p>';
  h += tabla_([['Producto', d.producto || '—'], ['LCC', d.lcc || '—'],
               ['Firmas', (d.firmas_ok || '0') + ' de ' + (d.firmas_req || '0')], ['Estado', d.estado || '']]);
  h += pie_();
  var t = (d.nombre_firmante || '') + ' firmo como ' + (d.rol || '') + '.\n' +
    'Producto: ' + (d.producto || '—') + '\nLCC: ' + (d.lcc || '—') + '\n' +
    'Firmas: ' + (d.firmas_ok || '0') + ' de ' + (d.firmas_req || '0') + '\nEstado: ' + (d.estado || '') + '\n';
  return { asunto: (listo ? '✅ Ficha lista: ' : '✍ Firma registrada: ') + (d.producto || ''), html: h, texto: t };
}

/* ---------- piezas del correo ---------- */
function cabecera_(titulo, color) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
    '<div style="background:' + color + ';color:#fff;padding:16px 22px;font-size:16px;font-weight:bold;letter-spacing:.5px">' + titulo + '</div>' +
    '<div style="padding:22px">';
}
function tabla_(filas) {
  var h = '<table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:18px">';
  filas.forEach(function (f, i) {
    h += '<tr style="background:' + (i % 2 ? '#f8fafc' : '#fff') + '">' +
      '<td style="padding:9px 12px;border:1px solid #e2e8f0;color:#64748b;width:110px">' + esc_(f[0]) + '</td>' +
      '<td style="padding:9px 12px;border:1px solid #e2e8f0;font-weight:bold">' + esc_(f[1]) + '</td></tr>';
  });
  return h + '</table>';
}
function boton_(link, texto) {
  if (!link) return '';
  return '<div style="text-align:center;margin:22px 0 6px">' +
    '<a href="' + esc_(link) + '" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;' +
    'padding:14px 28px;border-radius:8px;font-size:15px;font-weight:bold">' + texto + '</a></div>';
}
function pie_() {
  return '<p style="font-size:11.5px;color:#94a3b8;margin:22px 0 0;border-top:1px solid #e2e8f0;padding-top:12px">' +
    'Correo automático del sistema de fichas técnicas. No responda a este mensaje.</p></div></div>';
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   INSTALACION (una sola vez)

   1. Entre a script.google.com con la cuenta de Google desde la que deben
      salir los correos y cree un proyecto nuevo: "Correos de fichas".
   2. Borre lo que trae el editor y pegue TODO este archivo. Guarde.
   3. Elija la funcion "enviarPrueba" y oprima Ejecutar. Acepte los permisos
      (Configuracion avanzada > Ir a Correos de fichas > Permitir).
      Debe llegarle un correo de prueba a usted mismo.
   4. Boton azul "Implementar" > "Nueva implementacion".
         Tipo:                 Aplicacion web
         Ejecutar como:        Yo (su cuenta)
         Quien tiene acceso:   Cualquier persona
      Oprima Implementar y COPIE la URL que termina en /exec.
   5. Pegue esa URL en la aplicacion de fichas, en GAS_URL (arriba del archivo
      index.html). Guarde y publique.

   Si cambia este codigo despues: Implementar > Administrar implementaciones >
   lapiz > Version: Nueva > Implementar. La URL no cambia.
   ============================================================ */
