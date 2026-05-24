import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { formatDate } from './utils'

// PDF estilo LaTeX (clase `article`) — Times como serif (la built-in más
// cercana a Computer Modern) sin cursivas. Toda la composición es de altura
// dinámica: cada sección calcula cuánto espacio necesita y, si no cabe,
// pagina antes de dibujar para evitar enciemes.

const COLORS = {
  ink:      [10, 10, 14],
  rule:     [60, 60, 70],
  muted:    [110, 110, 120],
  red:      [165, 30, 30],
  redSoft:  [251, 240, 240],
  shade:    [246, 246, 244],
  border:   [200, 200, 200],
  // Paleta SecureRx (alineada con --cyan / --blue-deep del front).
  blue:     [10, 132, 255],
  blueDeep: [0, 82, 204],
  blueRule: [120, 178, 245],
  blueSoft: [232, 242, 255],
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN_X = 72
const MARGIN_TOP = 72
const MARGIN_BOTTOM = 72
const CONTENT_W = PAGE_W - MARGIN_X * 2

function setColor(doc, c, kind = 'text') {
  if (kind === 'text') doc.setTextColor(c[0], c[1], c[2])
  else if (kind === 'fill') doc.setFillColor(c[0], c[1], c[2])
  else if (kind === 'draw') doc.setDrawColor(c[0], c[1], c[2])
}

// ───────── primitivas de layout ─────────

// Paginar si el bloque de altura `needed` no cabe desde y.
function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE_H - MARGIN_BOTTOM) {
    drawFooter(doc)
    doc.addPage()
    return MARGIN_TOP
  }
  return y
}

// Texto justificado tipo LaTeX: reparte el espacio sobrante entre las
// palabras de cada línea (excepto la última). Devuelve la `y` siguiente.
function drawJustifiedParagraph(doc, text, x, y, width, lineHeight) {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return y

  const lines = []
  let line = []
  let lineW = 0
  const spaceW = doc.getTextWidth(' ')
  for (const w of words) {
    const wW = doc.getTextWidth(w)
    const candidate = lineW + (line.length ? spaceW : 0) + wW
    if (candidate <= width || line.length === 0) {
      line.push(w); lineW = candidate
    } else {
      lines.push({ words: line, naturalWidth: lineW })
      line = [w]; lineW = wW
    }
  }
  if (line.length) lines.push({ words: line, naturalWidth: lineW })

  let cy = y
  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1
    if (ln.words.length === 1 || isLast) {
      doc.text(ln.words.join(' '), x, cy)
    } else {
      const gaps = ln.words.length - 1
      const extra = (width - ln.naturalWidth) / gaps
      let cx = x
      ln.words.forEach((w, i) => {
        doc.text(w, cx, cy)
        if (i < ln.words.length - 1) cx += doc.getTextWidth(w) + spaceW + extra
      })
    }
    cy += lineHeight
  })
  return cy
}

// Variante "top-down" del párrafo justificado: trata `y` como la parte
// SUPERIOR del bloque (no la baseline tipográfica) para encajar con la
// convención top-based del resto de helpers de layout. Internamente añade
// el ascent de la fuente actual antes de delegar.
function drawJustifiedTop(doc, text, x, y, width, lineHeight) {
  const fs = doc.getFontSize()
  const ascent = fs * 0.78
  return drawJustifiedParagraph(doc, text, x, y + ascent, width, lineHeight)
}

// Mide cuántas líneas tomará el párrafo (para saber su altura antes de
// dibujarlo y poder paginar).
function measureParagraph(doc, text, width) {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  let lines = 0
  let lineW = 0
  let onLine = 0
  const spaceW = doc.getTextWidth(' ')
  for (const w of words) {
    const wW = doc.getTextWidth(w)
    const candidate = lineW + (onLine ? spaceW : 0) + wW
    if (candidate <= width || onLine === 0) {
      lineW = candidate; onLine++
    } else {
      lines++
      lineW = wW; onLine = 1
    }
  }
  return lines + (onLine > 0 ? 1 : 0)
}

function chunkString(str, perLine) {
  if (!str) return ['—']
  const out = []
  for (let i = 0; i < str.length; i += perLine) out.push(str.slice(i, i + perLine))
  return out
}

// ───────── piezas reusables ─────────

// Convención de `y` en todas estas helpers: representa el TOP del próximo
// bloque a dibujar (no la baseline tipográfica). Cada función calcula
// internamente la baseline = y + ascent y devuelve y + alturaRenderizada +
// gap, de modo que dos bloques consecutivos no se solapen jamás.

function drawSectionHeading(doc, number, title, y) {
  const blockH = 34
  y = ensureSpace(doc, y, blockH)
  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text(`${number}. ${title}`, MARGIN_X, y + 12) // baseline = y + ascent
  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(1.0)
  doc.line(MARGIN_X, y + 18, PAGE_W - MARGIN_X, y + 18)
  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y + 21, PAGE_W - MARGIN_X, y + 21)
  return y + blockH
}

function drawSubsection(doc, title, y) {
  const blockH = 24
  y = ensureSpace(doc, y, blockH)
  // Cintillo lateral azul (estilo \paragraph con color).
  setColor(doc, COLORS.blue, 'fill')
  doc.rect(MARGIN_X - 6, y + 4, 3, 12, 'F')
  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.text(title, MARGIN_X, y + 13)
  return y + blockH
}

function drawDescriptionItem(doc, label, value, y) {
  const labelTxt = `${label}:`
  doc.setFont('times', 'bold')
  doc.setFontSize(10.5)
  const labelW = doc.getTextWidth(labelTxt)
  const valueX = MARGIN_X + 12 + labelW + 6
  const valueW = CONTENT_W - (labelW + 6 + 12)

  doc.setFont('times', 'normal')
  const lines = doc.splitTextToSize(String(value ?? '—'), valueW)
  const lineH = 13
  const blockH = Math.max(16, lines.length * lineH + 2)
  y = ensureSpace(doc, y, blockH)

  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.text(labelTxt, MARGIN_X + 12, y + 10)
  setColor(doc, COLORS.ink, 'text')
  doc.setFont('times', 'normal')
  doc.text(lines, valueX, y + 10)
  return y + blockH
}

// Bloque \texttt{} con altura calculada a partir de las líneas reales.
function drawMonospaceBlock(doc, text, y, width) {
  const lines = chunkString(text, 78)
  const blockH = Math.max(22, lines.length * 10 + 16)
  const gap = 18  // espacio inferior antes del siguiente título
  y = ensureSpace(doc, y, blockH + gap)

  setColor(doc, COLORS.blueSoft, 'fill')
  doc.rect(MARGIN_X, y, width, blockH, 'F')
  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(0.4)
  doc.rect(MARGIN_X, y, width, blockH, 'S')

  setColor(doc, COLORS.ink, 'text')
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.8)
  let cy = y + 13
  for (const ln of lines) {
    doc.text(ln, MARGIN_X + 8, cy)
    cy += 10
  }
  return y + blockH + gap
}

// ───────── secciones del documento ─────────

function drawHeaderBar(doc, receta) {
  // Cintillo azul superior — banda completa de cabecera.
  setColor(doc, COLORS.blueDeep, 'fill')
  doc.rect(0, 0, PAGE_W, 4, 'F')
  setColor(doc, COLORS.blue, 'fill')
  doc.rect(0, 4, PAGE_W, 1.5, 'F')

  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(9)
  doc.text('SecureRx', MARGIN_X, 42)
  setColor(doc, COLORS.muted, 'text')
  doc.setFont('times', 'normal')
  doc.text(' · Recetario Digital Certificado',
    MARGIN_X + doc.getTextWidth('SecureRx'), 42)

  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  const folio = `Folio núm. ${receta.id}`
  const fw = doc.getTextWidth(folio)
  doc.text(folio, PAGE_W - MARGIN_X - fw, 42)

  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(0.6)
  doc.line(MARGIN_X, 50, PAGE_W - MARGIN_X, 50)
}

function drawTitle(doc, receta) {
  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(22)
  const title = 'Prescripción Médica Electrónica'
  const tw = doc.getTextWidth(title)
  doc.text(title, (PAGE_W - tw) / 2, 96)

  setColor(doc, COLORS.ink, 'text')
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  const author = `Dr. @${receta.medico_username || `id${receta.medico_id}`}`
  const aw = doc.getTextWidth(author)
  doc.text(author, (PAGE_W - aw) / 2, 120)

  setColor(doc, COLORS.muted, 'text')
  doc.setFontSize(10)
  const fecha = receta.fecha ? formatDate(receta.fecha) : '—'
  const fw2 = doc.getTextWidth(fecha)
  doc.text(fecha, (PAGE_W - fw2) / 2, 138)

  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(0.7)
  doc.line(MARGIN_X + 80, 150, PAGE_W - MARGIN_X - 80, 150)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X + 110, 154, PAGE_W - MARGIN_X - 110, 154)

  return 178
}

function drawAbstract(doc, yStart) {
  const abstract =
    'Documento electrónico emitido a través del sistema SecureRx. Su ' +
    'contenido ha sido cifrado con AES-128-GCM, envuelto con RSA-OAEP-2048 ' +
    'y firmado digitalmente por el médico prescriptor mediante ECDSA sobre ' +
    'la curva P-256 con resumen SHA3-256. La autenticidad del documento ' +
    'puede verificarse consultando el sello criptográfico incluido al final.'

  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  const inner = CONTENT_W - 60
  const lines = measureParagraph(doc, abstract, inner)
  const headingH = 22
  const paraH = lines * 12.5 + 6
  const needed = headingH + paraH + 10
  let y = ensureSpace(doc, yStart, needed)

  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(10.5)
  const heading = 'Resumen'
  const hw = doc.getTextWidth(heading)
  doc.text(heading, (PAGE_W - hw) / 2, y + 12)

  setColor(doc, COLORS.ink, 'text')
  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  drawJustifiedTop(doc, abstract, MARGIN_X + 30, y + headingH, inner, 12.5)
  return y + headingH + paraH + 10
}

function drawTamperedNotice(doc, receta, yStart) {
  if (receta.cripto_ok !== false) return yStart
  const motivo = receta.motivo_no_verificada
    || 'La firma digital ECDSA P-256 + SHA3-256 del médico emisor no coincide con el contenido descifrado de esta receta.'

  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  const innerW = CONTENT_W - 28
  const lines = measureParagraph(doc, motivo, innerW)
  const titleH = 26
  const textH = lines * 12 + 14
  const boxH = titleH + textH
  const y = ensureSpace(doc, yStart, boxH + 14)

  setColor(doc, COLORS.redSoft, 'fill')
  doc.rect(MARGIN_X, y, CONTENT_W, boxH, 'F')
  setColor(doc, COLORS.red, 'draw')
  doc.setLineWidth(0.6)
  doc.rect(MARGIN_X, y, CONTENT_W, boxH, 'S')
  doc.setLineWidth(2.4)
  doc.line(MARGIN_X, y, MARGIN_X, y + boxH)

  setColor(doc, COLORS.red, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.text('Atención — Verificación criptográfica fallida.', MARGIN_X + 14, y + 18)

  setColor(doc, COLORS.red, 'text')
  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  drawJustifiedTop(doc, motivo, MARGIN_X + 14, y + titleH, innerW, 12)
  return y + boxH + 14
}

function drawPartiesSection(doc, receta, yStart) {
  let y = drawSectionHeading(doc, '1', 'Identificación de las partes', yStart)
  y = drawSubsection(doc, 'Médico prescriptor', y)
  y = drawDescriptionItem(doc, 'Usuario', `@${receta.medico_username || `id${receta.medico_id}`}`, y)
  y = drawDescriptionItem(doc, 'Identificador interno', receta.medico_id ?? '—', y)
  y = drawDescriptionItem(doc, 'Certificado', 'X.509 v3 emitido por la CA de SecureRx', y)
  y = drawDescriptionItem(doc, 'Algoritmo de firma', 'ECDSA P-256 + SHA3-256', y)
  y += 6

  y = drawSubsection(doc, 'Paciente', y)
  y = drawDescriptionItem(doc, 'Usuario', `@${receta.paciente_username || `id${receta.paciente_id}`}`, y)
  y = drawDescriptionItem(doc, 'Identificador interno', receta.paciente_id ?? '—', y)
  return y + 8
}

function drawPrescriptionSection(doc, receta, yStart) {
  let y = drawSectionHeading(doc, '2', 'Prescripción', yStart)

  // Recuadro principal de altura dinámica.
  const med = receta.medicamento || '—'
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  const medLines = doc.splitTextToSize(med, CONTENT_W - 24).slice(0, 2)

  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  const detalle =
    `Dosis: ${receta.dosis || '—'}    ·    Cantidad: ${receta.cantidad ?? '—'} u.    ·    ` +
    `Dispensaciones: ${receta.dispensaciones_realizadas ?? 0} / ${receta.dispensaciones_permitidas ?? 1}`
  const detLines = doc.splitTextToSize(detalle, CONTENT_W - 24)

  const padTop = 14
  const padBottom = 14
  const labelH = 14
  const medH = medLines.length * 19
  const gap = 10
  const detH = detLines.length * 13
  const boxH = padTop + labelH + medH + gap + detH + padBottom
  y = ensureSpace(doc, y, boxH + 16)

  setColor(doc, COLORS.blueSoft, 'fill')
  doc.rect(MARGIN_X, y, CONTENT_W, boxH, 'F')
  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(0.5)
  doc.rect(MARGIN_X, y, CONTENT_W, boxH, 'S')
  // Cintillo lateral azul intenso.
  setColor(doc, COLORS.blueDeep, 'fill')
  doc.rect(MARGIN_X, y, 3, boxH, 'F')

  let cy = y + padTop
  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(9)
  doc.text('MEDICAMENTO', MARGIN_X + 12, cy)
  cy += labelH

  setColor(doc, COLORS.ink, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text(medLines, MARGIN_X + 12, cy + 2)
  cy += medH + gap

  setColor(doc, COLORS.ink, 'text')
  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  doc.text(detLines, MARGIN_X + 12, cy)
  y += boxH + 20

  // Indicaciones
  y = drawSubsection(doc, 'Indicaciones', y)
  const instr = receta.instrucciones || 'Sin indicaciones adicionales.'
  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  const instrLines = measureParagraph(doc, instr, CONTENT_W)
  const instrH = instrLines * 13.5 + 8
  y = ensureSpace(doc, y, instrH + 10)
  setColor(doc, COLORS.ink, 'text')
  drawJustifiedTop(doc, instr, MARGIN_X, y, CONTENT_W, 13.5)
  return y + instrH + 10
}

function drawCryptoSection(doc, receta, yStart) {
  let y = drawSectionHeading(doc, '3', 'Sello criptográfico', yStart)

  y = drawSubsection(doc, 'Huella SHA3-256 del contenido cifrado', y)
  y = drawMonospaceBlock(doc, receta.hash_sha3, y, CONTENT_W)

  y = drawSubsection(doc, 'Firma ECDSA del médico emisor', y)
  y = drawMonospaceBlock(doc, receta.firma_medico, y, CONTENT_W)

  y = drawSubsection(doc, 'Firma ECDSA del farmacéutico dispensador', y)
  if (receta.firma_farmaceutico) {
    y = drawMonospaceBlock(doc, receta.firma_farmaceutico, y, CONTENT_W)
  } else {
    y = ensureSpace(doc, y, 22)
    setColor(doc, COLORS.muted, 'text')
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text('Receta aún no dispensada; sin firma del farmacéutico.', MARGIN_X, y + 10)
    y += 22
  }
  return y + 4
}

function drawQrAndSignature(doc, receta, yStart, qrDataUrl) {
  const qrSize = 110
  const explica =
    'El presente código QR codifica el identificador interno de la receta. ' +
    'El personal farmacéutico autorizado puede escanearlo desde el sistema ' +
    'SecureRx para localizar el documento, validar la firma digital del ' +
    'médico emisor y registrar la dispensación correspondiente.'

  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  const rightX = MARGIN_X + qrSize + 24
  const rightW = CONTENT_W - qrSize - 24
  const explicaLines = measureParagraph(doc, explica, rightW)
  const explicaH = explicaLines * 13

  // Bloque completo: heading + figura/párrafo + caption + firma ribbon
  const headingH = 32
  const captionH = 18
  const sigH = 30
  const blockH = headingH + Math.max(qrSize, explicaH) + captionH + sigH
  let y = ensureSpace(doc, yStart, blockH + 8)

  y = drawSectionHeading(doc, '4', 'Código de verificación', y)

  // QR a la izquierda — marco azul para alinear con el resto del documento.
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', MARGIN_X, y, qrSize, qrSize)
    setColor(doc, COLORS.blueDeep, 'draw')
    doc.setLineWidth(0.6)
    doc.rect(MARGIN_X, y, qrSize, qrSize, 'S')
  } else {
    setColor(doc, COLORS.muted, 'text')
    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    doc.text('(QR no disponible)', MARGIN_X, y + qrSize / 2)
  }

  // Caption del QR debajo de la imagen
  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(9)
  doc.text(`Figura 1.`, MARGIN_X, y + qrSize + 16)
  setColor(doc, COLORS.muted, 'text')
  doc.setFont('times', 'normal')
  doc.text(` Código QR de la receta núm. ${receta.id}.`,
    MARGIN_X + doc.getTextWidth(`Figura 1.`),
    y + qrSize + 16)

  // Texto explicativo a la derecha del QR (top-based).
  setColor(doc, COLORS.ink, 'text')
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  drawJustifiedTop(doc, explica, rightX, y, rightW, 13)

  // Cintillo de firma debajo del bloque QR/explica.
  const bottomY = y + Math.max(qrSize + captionH, explicaH + 12) + 30
  setColor(doc, COLORS.blueDeep, 'draw')
  doc.setLineWidth(0.6)
  doc.line(PAGE_W - MARGIN_X - 220, bottomY, PAGE_W - MARGIN_X, bottomY)
  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  doc.setFontSize(9)
  const sigLabel = `Dr. @${receta.medico_username || `id${receta.medico_id}`} · firma ECDSA P-256`
  const slw = doc.getTextWidth(sigLabel)
  doc.text(sigLabel, PAGE_W - MARGIN_X - slw, bottomY + 12)

  return bottomY + 24
}

function drawFooter(doc) {
  const y = PAGE_H - 40
  setColor(doc, COLORS.blueRule, 'draw')
  doc.setLineWidth(0.4)
  doc.line(MARGIN_X, y - 18, PAGE_W - MARGIN_X, y - 18)

  setColor(doc, COLORS.muted, 'text')
  doc.setFont('times', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Compilado el ${formatDate(new Date().toISOString())} — SecureRx`, MARGIN_X, y - 4)

  setColor(doc, COLORS.blueDeep, 'text')
  doc.setFont('times', 'bold')
  const pageTxt = `— ${doc.getCurrentPageInfo().pageNumber} —`
  const w = doc.getTextWidth(pageTxt)
  doc.text(pageTxt, (PAGE_W - w) / 2, y - 4)
}

// ───────── entrada pública ─────────

export async function generateRecetaPdf(receta) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setFont('times', 'normal')

  let qrDataUrl = null
  try {
    qrDataUrl = await QRCode.toDataURL(String(receta.id), {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B2443ff', light: '#ffffffff' },
    })
  } catch {
    qrDataUrl = null
  }

  drawHeaderBar(doc, receta)
  let y = drawTitle(doc, receta)
  y = drawAbstract(doc, y)
  y = drawTamperedNotice(doc, receta, y)
  y = drawPartiesSection(doc, receta, y)
  y = drawPrescriptionSection(doc, receta, y)
  y = drawCryptoSection(doc, receta, y)
  y = drawQrAndSignature(doc, receta, y, qrDataUrl)

  drawFooter(doc)
  return doc
}

export async function downloadRecetaPdf(receta) {
  const doc = await generateRecetaPdf(receta)
  doc.save(`receta_${receta.id}_securerx.pdf`)
}
