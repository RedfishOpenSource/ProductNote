import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { Product } from '../types/product'
import { normalizeProductImages } from '../types/product'
import { exportFileBlob, resolveFileUrl } from './file-service'
import { formatPrice } from './product-format'

type ProductPdfRow = {
  imageUrl: string
  imageAlt: string
  name: string
  price: string
  description: string
  rowSpan: number
  isFirstRow: boolean
}

function buildExportFileName(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10)
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  return `商品清单-${datePart}-${timePart}.pdf`
}

async function buildRows(products: Product[]): Promise<ProductPdfRow[]> {
  const rows: ProductPdfRow[] = []

  for (const product of products) {
    const images = normalizeProductImages(product.image, product.images).filter((file) => file.mimeType.startsWith('image/'))
    const imageEntries = images.length
      ? await Promise.all(
          images.map(async (file, index) => ({
            imageUrl: await resolveFileUrl(file),
            imageAlt: `${product.name || '商品'} 图片 ${index + 1}`,
          })),
        )
      : [{ imageUrl: '', imageAlt: '无图片' }]

    imageEntries.forEach((entry, index) => {
      rows.push({
        imageUrl: entry.imageUrl,
        imageAlt: entry.imageAlt,
        name: product.name || '未填写商品名称',
        price: formatPrice(product.price),
        description: product.description || '未填写商品描述',
        rowSpan: imageEntries.length,
        isFirstRow: index === 0,
      })
    })
  }

  return rows
}

function createPdfTable(rows: ProductPdfRow[]): HTMLDivElement {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '1500px'
  container.style.background = '#ffffff'
  container.style.padding = '32px'
  container.style.boxSizing = 'border-box'
  container.style.fontFamily = 'Arial, Microsoft YaHei, PingFang SC, sans-serif'
  container.style.color = '#111827'

  const title = document.createElement('h1')
  title.textContent = '商品清单'
  title.style.margin = '0 0 16px'
  title.style.fontSize = '28px'
  container.appendChild(title)

  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'collapse'
  table.style.tableLayout = 'fixed'

  const colgroup = document.createElement('colgroup')
  ;['220px', '280px', '180px', '1fr'].forEach((width) => {
    const col = document.createElement('col')
    col.style.width = width
    colgroup.appendChild(col)
  })
  table.appendChild(colgroup)

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  ;['图片', '商品名称', '商品价格', '商品描述'].forEach((text) => {
    const cell = document.createElement('th')
    cell.textContent = text
    cell.style.border = '1px solid #d1d5db'
    cell.style.background = '#f3f4f6'
    cell.style.padding = '14px 12px'
    cell.style.fontSize = '18px'
    cell.style.textAlign = 'left'
    headerRow.appendChild(cell)
  })
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  rows.forEach((row) => {
    const tr = document.createElement('tr')

    const imageCell = document.createElement('td')
    imageCell.style.border = '1px solid #d1d5db'
    imageCell.style.padding = '10px'
    imageCell.style.verticalAlign = 'middle'
    imageCell.style.textAlign = 'center'

    if (row.imageUrl) {
      const image = document.createElement('img')
      image.src = row.imageUrl
      image.alt = row.imageAlt
      image.crossOrigin = 'anonymous'
      image.style.maxWidth = '180px'
      image.style.maxHeight = '180px'
      image.style.objectFit = 'contain'
      image.style.display = 'block'
      image.style.margin = '0 auto'
      imageCell.appendChild(image)
    } else {
      const placeholder = document.createElement('div')
      placeholder.textContent = '无图片'
      placeholder.style.height = '120px'
      placeholder.style.display = 'flex'
      placeholder.style.alignItems = 'center'
      placeholder.style.justifyContent = 'center'
      placeholder.style.color = '#6b7280'
      placeholder.style.background = '#f9fafb'
      imageCell.appendChild(placeholder)
    }

    tr.appendChild(imageCell)

    if (row.isFirstRow) {
      ;[
        { text: row.name, align: 'left' },
        { text: row.price, align: 'left' },
        { text: row.description, align: 'left' },
      ].forEach((item) => {
        const cell = document.createElement('td')
        cell.rowSpan = row.rowSpan
        cell.textContent = item.text
        cell.style.border = '1px solid #d1d5db'
        cell.style.padding = '14px 12px'
        cell.style.verticalAlign = 'top'
        cell.style.whiteSpace = 'pre-wrap'
        cell.style.wordBreak = 'break-word'
        cell.style.fontSize = item.text === row.description ? '16px' : '18px'
        tr.appendChild(cell)
      })
    }

    tbody.appendChild(tr)
  })

  table.appendChild(tbody)
  container.appendChild(table)
  return container
}

async function renderPdfBlob(rows: ProductPdfRow[]): Promise<Blob> {
  const container = createPdfTable(rows)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      imageTimeout: 0,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
    })

    const imageData = canvas.toDataURL('image/jpeg', 0.92)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
      compress: true,
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 24
    const renderWidth = pageWidth - margin * 2
    const renderHeight = (canvas.height * renderWidth) / canvas.width

    let remainingHeight = renderHeight
    let offsetY = 0

    pdf.addImage(imageData, 'JPEG', margin, margin + offsetY, renderWidth, renderHeight)
    remainingHeight -= pageHeight - margin * 2

    while (remainingHeight > 0) {
      offsetY -= pageHeight - margin * 2
      pdf.addPage()
      pdf.addImage(imageData, 'JPEG', margin, margin + offsetY, renderWidth, renderHeight)
      remainingHeight -= pageHeight - margin * 2
    }

    return pdf.output('blob')
  } finally {
    container.remove()
  }
}

export async function exportProductsPdf(products: Product[]): Promise<string> {
  const rows = await buildRows(products)
  const pdfBlob = await renderPdfBlob(rows)

  return await exportFileBlob(buildExportFileName(), pdfBlob, {
    mimeType: 'application/pdf',
    shareTitle: '商品清单',
    shareText: '商品清单 PDF 已生成',
    dialogTitle: '导出商品清单 PDF',
  })
}
