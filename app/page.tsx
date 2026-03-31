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
  AlertTriangle,
  Settings
} from 'lucide-react'
import { supabase, Card, Transaction, ActivityLog } from '../lib/supabase'

type KioskState = 'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'cooldown'

interface CardData {
  card: Card
  message: string
}

interface ConfigData {
  serverAddress: string
  serverPort: string
  panelAddress: string
  panelPort: string
  siteName: string
  lane: string
}

export default function ParkSmartKiosk() {
  const [state, setState] = useState<KioskState>('idle')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [todayPassages, setTodayPassages] = useState(0)
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Configuration state
  const [config, setConfig] = useState<ConfigData>({
    serverAddress: '',
    serverPort: '',
    panelAddress: '',
    panelPort: '',
    siteName: '',
    lane: ''
  })

  // Load saved configuration on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('kioskConfig')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(parsed)
      } catch (error) {
        console.error('Error loading config:', error)
      }
    }
  }, [])

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

  // IndexedDB helper functions
  const initDB = useCallback(async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('Gate24DB', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          transactionStore.createIndex('created_at', 'created_at')
          transactionStore.createIndex('card_number', 'card_number')
        }
        
        // Create activity logs store
        if (!db.objectStoreNames.contains('activity_logs')) {
          const logStore = db.createObjectStore('activity_logs', { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          logStore.createIndex('created_at', 'created_at')
          logStore.createIndex('action', 'action')
        }
      }
    })
  }, [])

  // Récupérer les statistiques du jour avec IndexedDB
  const fetchTodayStats = useCallback(async () => {
    try {
      const db = await initDB()
      const today = format(new Date(), 'yyyy-MM-dd')
      
      return new Promise<number>((resolve) => {
        const transaction = db.transaction(['transactions'], 'readonly')
        const store = transaction.objectStore('transactions')
        const index = store.index('created_at')
        
        const range = IDBKeyRange.bound(
          `${today}T00:00:00`,
          `${today}T23:59:59`
        )
        
        const request = index.count(range)
        request.onsuccess = () => resolve(request.result || 0)
        request.onerror = () => resolve(0)
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error)
      return 0
    }
  }, [initDB])

  // Créer une transaction avec IndexedDB
  const createTransaction = useCallback(async (card: Card): Promise<void> => {
    try {
      const db = await initDB()
      
      // Insérer transaction
      const transaction = db.transaction(['transactions'], 'readwrite')
      const store = transaction.objectStore('transactions')
      
      await store.add({
        card_id: card.id,
        card_number: card.card_number,
        holder_name: card.holder_name,
        transaction_type: 'entry',
        amount: 0,
        barrier_id: 'main_entrance',
        created_at: new Date().toISOString(),
        site: config.siteName,
        lane: config.lane
      })

      // Logger l'activité
      const logTransaction = db.transaction(['activity_logs'], 'readwrite')
      const logStore = logTransaction.objectStore('activity_logs')
      
      await logStore.add({
        action: 'card_scan',
        details: 'Accès autorisé',
        card_number: card.card_number,
        holder_name: card.holder_name,
        success: true,
        created_at: new Date().toISOString(),
        site: config.siteName,
        lane: config.lane
      })

    } catch (error) {
      console.error('Erreur transaction:', error)
    }
  }, [initDB, config])

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
          <div>SAFER</div>
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
          <strong>Solde:</strong> ${card.balance} FCFA
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
      
      // Appeler l'API Homintec
      const apiResult = await callHomintecAPI(cardNumber)
      
      if (apiResult.success) {
        // Succès API - créer un objet card à partir des données API
        const apiCard: Card = {
          id: cardNumber,
          card_number: cardNumber,
          rfid_code: cardNumber,
          holder_name: `${apiResult.data.prenom} ${apiResult.data.nom}`,
          category: apiResult.data.targType,
          subscription_type: 'credits',
          balance: parseInt(apiResult.data.solde), // Convertir le solde en crédits
          is_active: apiResult.data.statutTarg === 'actived',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 an par défaut
          created_at: new Date().toISOString()
        }
        
        setCardData({ card: apiCard, message: 'Carte valide' })
        setState('success')
        
        // Actions en parallèle
        await Promise.all([
          createTransaction(apiCard),
          openBarrier(),
          fetchTodayStats()
        ])
        
        // Imprimer ticket avec les données API
        setTimeout(() => printTicket(apiCard), 1000)
        
        // Reset après 3 secondes
        setTimeout(() => {
          setState('cooldown')
          setTimeout(() => {
            setState('idle')
            setCardData(null)
          }, 2000)
        }, 3000)
      } else {
        // Erreur API
        setError(apiResult.message)
        setState('error')
        
        // Logger l'erreur
        try {
          await supabase.from('activity_logs').insert({
            action: 'card_scan',
            details: apiResult.message,
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
  }, [state, callHomintecAPI, createTransaction, openBarrier, fetchTodayStats, printTicket])


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
    <div className="kiosk-screen relative overflow-hidden">
      {/* Background animated elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 glass-effect m-6 p-6 rounded-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-xl blur-lg animate-glow" />
              <div className="relative bg-gradient-to-r from-cyan-500 to-indigo-500 p-3 rounded-xl">
                <Car className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Gate24</h1>
              <p className="text-cyan-300 text-sm font-medium">Borne de Télépaiement</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-8">
            <div className="text-white text-right">
              <div className="text-2xl font-bold font-mono tracking-wider">
                {format(currentTime, 'HH:mm:ss', { locale: fr })}
              </div>
              <div className="text-sm text-cyan-300 capitalize">
                {format(currentTime, 'EEEE dd MMMM yyyy', { locale: fr })}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
              {isOnline ? (
                <>
                  <Wifi className="w-5 h-5 text-green-400 animate-pulse" />
                  <span className="text-white text-sm font-medium">En ligne</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5 text-red-400" />
                  <span className="text-red-300 text-sm font-medium">Hors ligne</span>
                </>
              )}
            </div>

            <a
              href="/config"
              className="flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-all"
              title="Configuration"
            >
              <Settings className="w-5 h-5 text-cyan-400" />
              <span className="text-white text-sm font-medium">Config</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {/* État IDLE */}
          {state === 'idle' && (
            <div className="animate-fade-in">
              <div className="glass-effect p-12 rounded-3xl text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-full blur-2xl animate-pulse-glow" />
                  <div className="relative bg-gradient-to-r from-cyan-500 to-indigo-500 p-8 rounded-full">
                    <CreditCard className="w-32 h-32 text-white animate-pulse" />
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold mb-4 text-white">
                  Présentez votre carte
                </h2>
                <p className="text-cyan-300 text-lg mb-8">
                  Approchez votre carte de la borne
                </p>
                
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-indigo-400/20 rounded-2xl blur-xl" />
                  <input
                    ref={inputRef}
                    type="text"
                    className="relative w-full p-4 border-2 border-cyan-400/50 rounded-2xl bg-white/10 text-white placeholder-cyan-300 text-lg font-mono backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                    placeholder="Entrez numéro de carte et appuyez Entrée"
                    onChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    onPaste={handlePaste}
                    autoFocus
                  />
                </div>
                
                <div className="mt-6 flex items-center justify-center space-x-2 text-cyan-300">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-sm">Prêt à lire</span>
                </div>
              </div>
            </div>
          )}

          {/* État SCANNING */}
          {state === 'scanning' && (
            <div className="animate-fade-in">
              <div className="glass-effect p-12 rounded-3xl text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full blur-2xl animate-spin-slow" />
                  <div className="relative bg-gradient-to-r from-cyan-500 to-blue-500 p-8 rounded-full">
                    <Loader2 className="w-32 h-32 text-white animate-spin" />
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold mb-4 text-white">
                  Lecture en cours...
                </h2>
                <p className="text-cyan-300 text-lg">
                  Veuillez patienter
                </p>
                
                <div className="mt-6 flex justify-center space-x-2">
                  <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* État PROCESSING */}
          {state === 'processing' && (
            <div className="animate-fade-in">
              <div className="glass-effect p-12 rounded-3xl text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full blur-2xl animate-pulse" />
                  <div className="relative bg-gradient-to-r from-indigo-500 to-purple-500 p-8 rounded-full">
                    <ShieldCheck className="w-32 h-32 text-white animate-pulse" />
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold mb-4 text-white">
                  Vérification...
                </h2>
                <p className="text-cyan-300 text-lg">
                  Validation de votre accès
                </p>
                
                <div className="mt-6">
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full animate-pulse" style={{ width: '60%', animation: 'pulse 2s infinite' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* État SUCCESS */}
          {state === 'success' && cardData && (
            <div className="animate-slide-up">
              <div className="glass-effect p-12 rounded-3xl text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full blur-2xl animate-pulse" />
                  <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 p-8 rounded-full">
                    <CheckCircle2 className="w-32 h-32 text-white animate-pulse" />
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold mb-6 text-white">
                  Accès autorisé
                </h2>
                
                <div className="bg-green-500/20 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-green-400/30">
                  <p className="text-white font-semibold text-xl mb-3">
                    {cardData.card.holder_name}
                  </p>
                  <div className="space-y-2 text-cyan-300">
                    <p className="text-sm">
                      <span className="font-medium">Carte:</span> {cardData.card.card_number}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Catégorie:</span> {cardData.card.category}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-center space-x-2 text-green-300">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-sm">
                    Barrière ouverte • Ticket en cours d'impression
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* État ERROR */}
          {state === 'error' && (
            <div className="animate-fade-in">
              <div className="glass-effect p-12 rounded-3xl text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-400 rounded-full blur-2xl animate-pulse" />
                  <div className="relative bg-gradient-to-r from-red-500 to-orange-500 p-8 rounded-full">
                    <XCircle className="w-32 h-32 text-white animate-pulse" />
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold mb-6 text-white">
                  Accès refusé
                </h2>
                
                <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-red-400/30">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="text-red-300 font-semibold text-lg">
                    {error}
                  </p>
                </div>
                
                <p className="text-cyan-300">
                  Veuillez réessayer
                </p>
              </div>
            </div>
          )}

          {/* État COOLDOWN */}
          {state === 'cooldown' && (
            <div className="animate-fade-in">
              <div className="glass-effect p-12 rounded-3xl text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-slate-400 rounded-full blur-2xl animate-pulse" />
                  <div className="relative bg-gradient-to-r from-gray-500 to-slate-500 p-8 rounded-full">
                    <Loader2 className="w-32 h-32 text-white animate-spin" />
                  </div>
                </div>
                
                <p className="text-white text-xl">
                  Réinitialisation...
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 glass-effect m-6 p-6 rounded-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <div className="bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="text-cyan-300 text-sm font-medium mb-1">Passages aujourd'hui</div>
              <div className="text-3xl font-bold text-white">{todayPassages}</div>
            </div>
            
            {config.siteName && (
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-4 rounded-xl backdrop-blur-sm">
                <div className="text-purple-300 text-sm font-medium mb-1">Site</div>
                <div className="text-lg font-bold text-white">{config.siteName}</div>
              </div>
            )}
            
            {config.lane && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-4 rounded-xl backdrop-blur-sm">
                <div className="text-green-300 text-sm font-medium mb-1">Voie</div>
                <div className="text-lg font-bold text-white">{config.lane}</div>
              </div>
            )}
          </div>
          
          <div className="text-cyan-300 text-sm font-medium">
            Gate24 Pro v1.0 • Système de Télépaiement
          </div>
        </div>
      </footer>
    </div>
  )
}
