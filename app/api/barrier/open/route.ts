import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Simuler l'ouverture de la barrière
    // Dans un vrai système, ceci communiquerait avec un hardware API
    
    console.log('🚪 Ouverture de la barrière demandée')
    
    // Simuler un délai d'ouverture
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('✅ Barrière ouverte avec succès')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Barrière ouverte avec succès',
      opened_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Erreur ouverture barrière:', error)
    
    return NextResponse.json({ 
      success: false, 
      message: 'Erreur lors de l\'ouverture de la barrière' 
    }, { status: 500 })
  }
}
