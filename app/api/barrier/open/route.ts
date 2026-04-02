import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 Ouverture de la barrière demandée')
    
    // Récupérer l'IP et le port de la barrière depuis le body
    const body = await request.json().catch(() => ({}))
    const barrierAddress = body.barrierAddress || '127.0.0.1'
    const barrierPort = body.barrierPort || '5001'
    
    const barrierUrl = `http://${barrierAddress}:${barrierPort}/open/1`
    console.log('🔗 URL barrière:', barrierUrl)
    
    // Appel à l'API hardware de la barrière
    const barrierResponse = await fetch(barrierUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY' : "supersecret"
      },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!barrierResponse.ok) {
      throw new Error(`Erreur API barrière: ${barrierResponse.status}`)
    }
    
    const result = await barrierResponse.text()
    console.log('✅ Barrière ouverte avec succès:', result)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Barrière ouverte avec succès',
      hardware_response: result,
      opened_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Erreur ouverture barrière:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    
    return NextResponse.json({ 
      success: false, 
      message: `Erreur lors de l'ouverture de la barrière: ${errorMessage}` 
    }, { status: 500 })
  }
}
