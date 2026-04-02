import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 Ouverture de la barrière demandée')
    
    // Appel à l'API hardware de la barrière
    const barrierResponse = await fetch('http://127.0.0.1:5001/open/1', {
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
