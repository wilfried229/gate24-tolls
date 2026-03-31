'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { 
  CreditCard, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Wifi, 
  WifiOff, 
  Car, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react'
import { supabase, Card, Transaction, ActivityLog } from '../lib/supabase'

type KioskState = 'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'cooldown'

interface CardData {
  card: Card
  message: string
}

export default function ParkSmartKiosk() {
  const [state, setState] = useState<KioskState>('idle')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [todayPassages, setTodayPassages] = useState(0)
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Mettre à jour l'horloge toutes les secondes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Détecter la connectivité
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Récupérer les statistiques du jour
  const fetchTodayStats = useCallback(async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { count } = await supabase
        .from('gopass_transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)

      setTodayPassages(count || 0)
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error)
    }
  }, [])

  useEffect(() => {
    fetchTodayStats()
    const interval = setInterval(fetchTodayStats, 30000) // Toutes les 30 secondes
    return () => clearInterval(interval)
  }, [fetchTodayStats])

  // Focus automatique sur l'input caché
  useEffect(() => {
    if (state === 'idle' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [state])

  // Rechercher une carte
  const searchCard = useCallback(async (cardNumber: string): Promise<CardData | null> => {
    try {
      const { data: card, error } = await supabase
        .from('gopass_cards')
        .select('*')
        .or(`card_number.eq.${cardNumber},rfid_code.eq.${cardNumber}`)
        .single()

      if (error || !card) {
        return { card: null as any, message: 'Carte non trouvée' }
      }

      // Vérifications
      if (!card.is_active) {
        return { card, message: 'Carte désactivée' }
      }

      if (new Date(card.expires_at) < new Date()) {
        return { card, message: 'Carte expirée' }
      }

      if (card.subscription_type === 'credits' && card.balance <= 0) {
        return { card, message: 'Solde insuffisant' }
      }

      return { card, message: 'Carte valide' }
    } catch (error) {
      console.error('Erreur recherche carte:', error)
      return { card: null as any, message: 'Erreur système' }
    }
  }, [])

  // Créer une transaction
  const createTransaction = useCallback(async (card: Card): Promise<void> => {
    try {
      // Insérer transaction
      await supabase.from('gopass_transactions').insert({
        card_id: card.id,
        transaction_type: 'entry',
        amount: 0,
        barrier_id: 'main_entrance'
      })

      // Mettre à jour solde si nécessaire
      if (card.subscription_type === 'credits') {
        await supabase
          .from('gopass_cards')
          .update({ balance: card.balance - 1 })
          .eq('id', card.id)
      }

      // Logger l'activité
      await supabase.from('activity_logs').insert({
        action: 'card_scan',
        details: 'Accès autorisé',
        card_number: card.card_number,
        holder_name: card.holder_name,
        success: true
      })

    } catch (error) {
      console.error('Erreur transaction:', error)
    }
  }, [])

  // Ouvrir la barrière
  const openBarrier = useCallback(async () => {
    try {
      await fetch('/api/barrier/open', { method: 'POST' })
    } catch (error) {
      console.error('Erreur ouverture barrière:', error)
    }
  }, [])

  // Imprimer le ticket
  const printTicket = useCallback((card: Card) => {
    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
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
        </style>
      </head>
      <body>
        <div class="header">
          <div>Gate24 PRO</div>
          <div style="font-size: 10px;">*******************</div>
        </div>
        
        <div class="line">
          <strong>Date:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}
        </div>
        
        <div class="divider"></div>
        
        <div class="line">
          <strong>Titulaire:</strong><br/>
          ${card.holder_name}
        </div>
        
        <div class="line">
          <strong>Carte N°:</strong> ${card.card_number}
        </div>
        
        <div class="line">
          <strong>Catégorie:</strong> ${card.category}
        </div>
        
        <div class="line">
          <strong>Abonnement:</strong> ${
            card.subscription_type === 'unlimited' ? 'Illimité' : `Crédits: ${card.balance}`
          }
        </div>
        
        <div class="divider"></div>
        
        <div class="line" style="text-align: center; font-size: 10px;">
          Merci de votre confiance
        </div>
      </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
    
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }
    
    iframe.srcdoc = ticketHTML
  }, [])

  // Gérer le scan de carte
  const handleCardScan = useCallback(async (cardNumber: string) => {
    if (state !== 'idle') return

    setState('scanning')
    setCardData(null)
    setError('')

    setTimeout(async () => {
      setState('processing')
      
      const result = await searchCard(cardNumber)
      
      if (result.card && result.message === 'Carte valide') {
        setCardData(result)
        setState('success')
        
        // Actions en parallèle
        await Promise.all([
          createTransaction(result.card),
          openBarrier(),
          fetchTodayStats()
        ])
        
        // Imprimer ticket
        setTimeout(() => printTicket(result.card), 1000)
        
        // Reset après 3 secondes
        setTimeout(() => {
          setState('cooldown')
          setTimeout(() => {
            setState('idle')
            setCardData(null)
          }, 2000)
        }, 3000)
      } else {
        setError(result.message)
        setState('error')
        
        // Logger l'erreur
        try {
          await supabase.from('activity_logs').insert({
            action: 'card_scan',
            details: result.message,
            card_number: cardNumber,
            success: false
          })
        } catch (logError) {
          console.error('Erreur logging:', logError)
        }
        
        // Reset après 2 secondes
        setTimeout(() => {
          setState('cooldown')
          setTimeout(() => setState('idle'), 1000)
        }, 2000)
      }
    }, 1500)
  }, [state, searchCard, createTransaction, openBarrier, fetchTodayStats, printTicket])

  // Global keyboard listener for kiosk mode
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (state !== 'idle' || !inputRef.current) return
      
      // Focus input if any key is pressed
      if (!document.activeElement || document.activeElement !== inputRef.current) {
        inputRef.current.focus()
      }
      
      // Handle Enter globally
      if (e.key === 'Enter' && inputRef.current.value) {
        const cardNumber = inputRef.current.value.trim()
        if (cardNumber) {
          handleCardScan(cardNumber)
          inputRef.current.value = ''
        }
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [state, handleCardScan])

  // Gérer l'input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    console.log('Input changed:', value)

    if (value.includes('\n') || value.includes('\r')) {
      const cardNumber = value.replace(/[\n\r]/g, '').trim()
      if (cardNumber) {
        handleCardScan(cardNumber)
      }
      e.target.value = ''
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('Key pressed:', e.key)
    if (e.key === 'Enter') {
      const cardNumber = (e.target as HTMLInputElement).value.trim()
      console.log('Enter pressed, card number:', cardNumber)
      if (cardNumber) {
        handleCardScan(cardNumber)
        ;(e.target as HTMLInputElement).value = ''
      }
      e.preventDefault()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    const cardNumber = pastedText.trim()
    console.log('Pasted:', cardNumber)
    if (cardNumber) {
      handleCardScan(cardNumber)
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  return (
    <div className="kiosk-screen flex flex-col">
      {/* Header */}
      <header className="glass-effect m-4 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Car className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-white"> Gate24</h1>
            <p className="text-cyan-300 text-sm">Borne de Télépaiement</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-white text-right">
            <div className="text-lg font-semibold">
              {format(currentTime, 'HH:mm:ss', { locale: fr })}
            </div>
            <div className="text-sm text-cyan-300">
              {format(currentTime, 'EEEE dd MMMM yyyy', { locale: fr })}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-white">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="status-card max-w-md w-full text-center">
          
          {/* État IDLE */}
          {state === 'idle' && (
            <div className="animate-fade-in">
              <CreditCard className="w-24 h-24 mx-auto mb-6 text-cyan-400 animate-pulse-glow" />
              <h2 className="text-3xl font-bold mb-4 text-white">
                Présentez votre carte
              </h2>
              <p className="text-cyan-300 mb-8">
                Approchez votre carte de la borne
              </p>
              
              <input
                ref={inputRef}
                type="text"
                className="w-full p-2 border border-cyan-400 rounded bg-white/10 text-white placeholder-cyan-300"
                placeholder="Entrez numéro de carte et appuyez Entrée"
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                autoFocus
              />
            </div>
          )}

          {/* État SCANNING */}
          {state === 'scanning' && (
            <div className="animate-fade-in">
              <Loader2 className="w-24 h-24 mx-auto mb-6 text-cyan-400 animate-spin-slow" />
              <h2 className="text-3xl font-bold mb-4 text-white">
                Lecture en cours...
              </h2>
              <p className="text-cyan-300">
                Veuillez patienter
              </p>
            </div>
          )}

          {/* État PROCESSING */}
          {state === 'processing' && (
            <div className="animate-fade-in">
              <ShieldCheck className="w-24 h-24 mx-auto mb-6 text-indigo-400 animate-pulse" />
              <h2 className="text-3xl font-bold mb-4 text-white">
                Vérification...
              </h2>
              <p className="text-cyan-300">
                Validation de votre accès
              </p>
            </div>
          )}

          {/* État SUCCESS */}
          {state === 'success' && cardData && (
            <div className="animate-slide-up">
              <CheckCircle2 className="w-24 h-24 mx-auto mb-6 text-green-400" />
              <h2 className="text-3xl font-bold mb-4 text-white">
                Accès autorisé
              </h2>
              
              <div className="bg-green-500/20 rounded-xl p-4 mb-6">
                <p className="text-white font-semibold mb-2">
                  {cardData.card.holder_name}
                </p>
                <p className="text-cyan-300 text-sm">
                  Carte: {cardData.card.card_number}
                </p>
                <p className="text-cyan-300 text-sm">
                  {cardData.card.category}
                </p>
              </div>
              
              <p className="text-green-300">
                Barrière ouverte • Ticket en cours d'impression
              </p>
            </div>
          )}

          {/* État ERROR */}
          {state === 'error' && (
            <div className="animate-fade-in">
              <XCircle className="w-24 h-24 mx-auto mb-6 text-red-400" />
              <h2 className="text-3xl font-bold mb-4 text-white">
                Accès refusé
              </h2>
              <div className="bg-red-500/20 rounded-xl p-4 mb-6">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                <p className="text-red-300 font-semibold">
                  {error}
                </p>
              </div>
              <p className="text-cyan-300">
                Veuillez réessayer
              </p>
            </div>
          )}

          {/* État COOLDOWN */}
          {state === 'cooldown' && (
            <div className="animate-fade-in">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-cyan-400 animate-spin" />
              <p className="text-white">
                Réinitialisation...
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="glass-effect m-4 p-4 flex justify-between items-center">
        <div className="text-white">
          <div className="text-sm text-cyan-300">Passages aujourd'hui</div>
          <div className="text-2xl font-bold">{todayPassages}</div>
        </div>
        
        <div className="text-cyan-300 text-sm">
          Gate24 Pro v1.0 • Système de Télépaiement
        </div>
      </footer>
    </div>
  )
}
