import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir, platform } from 'os'

const execAsync = promisify(exec)

// Détecter Chrome/Chromium selon l'OS
function getChromePath(): string {
  const os = platform()
  
  if (os === 'win32') {
    // Windows - chemins possibles
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'chrome' // si dans PATH
    ]
    return winPaths[0] // Premier par défaut
  } else if (os === 'darwin') {
    // macOS
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else {
    // Linux
    return 'chromium'
  }
}

// Imprimer selon l'OS
async function printFile(filePath: string, printerName: string): Promise<string> {
  const os = platform()
  
  if (os === 'win32') {
    // Windows - utiliser SumatraPDF ou Chrome directement
    const chromePath = getChromePath()
    const cmd = printerName === 'default'
      ? `"${chromePath}" --headless --print --print-to-pdf-no-header "${filePath}"`
      : `"${chromePath}" --headless --print --print-to-pdf-no-header "${filePath}"`
    const { stdout } = await execAsync(cmd)
    return stdout
  } else {
    // Linux/macOS - utiliser CUPS
    const cmd = printerName === 'default' 
      ? `lp "${filePath}"`
      : `lp -d ${printerName} "${filePath}"`
    const { stdout } = await execAsync(cmd)
    return stdout
  }
}

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

    // Convertir en PDF avec Chrome/Chromium selon l'OS
    const pdfFile = tempFile.replace('.html', '.pdf')
    const chromePath = getChromePath()
    
    try {
      await execAsync(
        `"${chromePath}" --headless --disable-gpu --print-to-pdf-no-header --print-to-pdf="${pdfFile}" "${tempFile}"`
      )
    } catch (error) {
      console.error('Erreur conversion PDF:', error)
      throw new Error('Impossible de convertir le ticket en PDF. Chrome/Chromium est-il installé ?')
    }

    // Imprimer selon l'OS
    const stdout = await printFile(pdfFile, printerName)
    
    // Nettoyer les fichiers temporaires
    await unlink(tempFile).catch(() => {})
    await unlink(pdfFile).catch(() => {})

    return NextResponse.json({ 
      success: true, 
      message: 'Ticket envoyé à l\'imprimante',
      jobId: stdout?.trim() || 'unknown'
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
