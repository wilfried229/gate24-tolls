import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { content, printerName = 'default' } = await request.json()

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Contenu du ticket manquant' },
        { status: 400 }
      )
    }

    // Créer un fichier HTML temporaire
    const tempFile = join(tmpdir(), `ticket-${Date.now()}.html`)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body { 
      font-family: 'Courier New', monospace; 
      width: 80mm; 
      margin: 0; 
      padding: 10px;
      font-size: 12px;
    }
    .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
    .line { margin: 5px 0; }
    .divider { border-top: 1px dashed #000; margin: 10px 0; }
    p { margin: 0; }
  </style>
</head>
<body>
  ${content}
</body>
</html>
    `

    await writeFile(tempFile, htmlContent)

    // Convertir en PDF avec Chromium en mode headless
    const pdfFile = tempFile.replace('.html', '.pdf')
    await execAsync(
      `chromium --headless --disable-gpu --print-to-pdf-no-header --print-to-pdf="${pdfFile}" "${tempFile}"`
    )

    // Imprimer avec CUPS (lp command)
    const printCmd = printerName === 'default' 
      ? `lp "${pdfFile}"`
      : `lp -d ${printerName} "${pdfFile}"`
    
    const { stdout, stderr } = await execAsync(printCmd)
    
    // Nettoyer les fichiers temporaires
    await unlink(tempFile).catch(() => {})
    await unlink(pdfFile).catch(() => {})

    if (stderr && !stdout.includes('request id')) {
      throw new Error(stderr)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Ticket envoyé à l\'imprimante',
      jobId: stdout.trim()
    })

  } catch (error) {
    console.error('Erreur impression:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
