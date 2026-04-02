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
import { io, Socket } from 'socket.io-client'

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
  kioskAddress: string
}

export default function ParkSmartKiosk() {
  const [state, setState] = useState<KioskState>('idle')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [isPinging, setIsPinging] = useState(false)
  const [todayPassages, setTodayPassages] = useState(0)
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)
  
  // Configuration state
  const [config, setConfig] = useState<ConfigData>({
    serverAddress: '',
    serverPort: '',
    panelAddress: '',
    panelPort: '',
    siteName: '',
    lane: '',
    kioskAddress: '',
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

    useEffect(() => {
    const tollName = config.siteName;
    const dataSend = { color: 7, front: 'small', light: 0, row1: "BIENVENU", row2: "PEAGE", row3: tollName, row4: 'SAFER', bright: 71 };
    ////sendMessagePanneau(dataSend);

  }, []);


   const sendMessagePanneau = async (data: any) => {
    const LED_IP = config.panelAddress;
    const LED_PORT = config.panelPort;
    data.url = { panelAddress: LED_IP, panelPort: LED_PORT };
    await fetch("/api/led", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  // Mettre à jour l'horloge toutes les secondes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Vérifier la connectivité avec le serveur (ping simple IP)
  const checkServerConnectivity = useCallback(async (): Promise<boolean> => {
    if (!config.serverAddress || !config.serverPort) {
      console.log('Config serveur non définie, ping ignoré')
      return false
    }
    
    try {
      const response = await fetch(`http://${config.serverAddress}:${config.serverPort}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      })
      return true
    } catch (error) {
      console.error('Server ping failed:', error)
      return false
    }
  }, [config])

  // Détecter la connectivité et faire des pings continus
  useEffect(() => {
    const handleOnline = async () => {
      const isServerOnline = await checkServerConnectivity()
      setIsOnline(isServerOnline)
    }
    
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Vérification initiale
    handleOnline()

    // Ping continu toutes les 5 secondes
    const interval = setInterval(async () => {
      setIsPinging(true)
      const isServerOnline = await checkServerConnectivity()
      setIsOnline(isServerOnline)
      setIsPinging(false)
    }, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [checkServerConnectivity, config])

  // Appel API Homintec
  const callHomintecAPI = useCallback(async (cardNumber: string,typeTag: string): Promise<{success: boolean, data?: any, message: string}> => {
    try {
      const response = await fetch(`http://${config.serverAddress}:${config.serverPort}/api/v2/homintec/passage/abonners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site: config.siteName,
          voie: config.lane,
          montant_passage: 500,
          targId: cardNumber,
          percepteur: "Gate24_KIOSK",
          typeTag: typeTag
        })
      })

      let data
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        // Parse as JSON if content type is JSON
        data = await response.json()

        console.log("datdat",data)
      } else {
        // Parse as text for non-JSON responses
        const textResponse = await response.text()
        console.log('Non-JSON response:', textResponse)
        
        // Handle specific text responses
        if (textResponse.includes('PASSAGE REFUSE')) {
          return { 
            success: false, 
            message: 'Passage refusé'
          }
        }


           if (textResponse.includes('TAG INVALID')) {
          return { 
            success: false, 
            message: 'Tag invalide'
          }
        }

        
         if (textResponse.includes('TAG DELECTED')) {
          return { 
            success: false, 
            message: 'Abonnement supprimé'
          }
        }


         if (textResponse.includes('TAG DESACTIVER')) {
          return { 
            success: false, 
            message: 'Abonnement desactivé'
          }
        }
        

         if (textResponse.includes('SOLDE INSUFFISANT')) {
          return { 
            success: false, 
            message: 'Solde insuffisant'
          }
        }
        
        

        return { 
          success: false, 
          message: textResponse || 'Réponse invalide du serveur'
        }
      }
      
      if (response.status === 200 || response.status === 201) {
        // Succès - carte valide
        console.log('API response:', data)
        return { 
          success: true, 
          data: data,
          message: 'Carte valide'
        }
      } else {
        // Gérer les différents cas d'erreur
        let errorMessage = 'Erreur inconnue'
        
        switch (response.status) {
          case 400:
            errorMessage = 'Tag invalide'
            break
          case 401:
            errorMessage = 'Tag désactivé'
            break
          case 402:
            errorMessage = 'Tag supprimé'
            break
          case 300:
            errorMessage = 'Solde insuffisant'
            break
          case 403:
            errorMessage = 'Passage refusé'
            break
          default:
            errorMessage = data.response || 'Erreur API'
        }
        
        console.error('API error:', response.status, errorMessage)
        return { 
          success: false, 
          message: errorMessage
        }
      }
    } catch (error) {
      console.error('Error calling Homintec API:', error)
      return { 
        success: false, 
        message: 'Erreur de connexion à l\'API'
      }
    }
  }, [config])

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
      await fetch('/api/barrier/open', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barrierAddress: config.kioskAddress,
          barrierPort: '5001'
        })
      })
    } catch (error) {
      console.error('Erreur ouverture barrière:', error)
    }
  }, [config])

  // Imprimer le ticket via API backend (sans boîte de dialogue navigateur)
  /* const printTicket = useCallback(async (card: Card) => {
    const ticketContent = `
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
    `

    try {
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: ticketContent })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Ticket imprimé:', result.jobId)
      } else {
        console.error('❌ Erreur impression:', result.error)
        // Fallback: impression navigateur si l'API échoue
        fallbackPrintTicket(card)
      }
    } catch (error) {
      console.error('❌ Erreur API impression:', error)
      // Fallback: impression navigateur
      fallbackPrintTicket(card)
    }
  }, []) */


  const printTicket = useCallback(async (card: Card) => {
      fallbackPrintTicket(card)
  }, [])
  // Fallback: impression via navigateur (iframe)
  const fallbackPrintTicket = (card: Card) => {
    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { margin: 0; size: 80mm auto; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
            @page { margin: 0; size: 80mm auto; }
          }
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            margin: 0; 
            padding: 10px;
            font-size: 14px;
          }
          .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
          .line { margin: 5px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          p { margin: 0; }
        </style>
      </head>
      <body onload="window.print(); setTimeout(() => window.close(), 500);">
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

    const printWindow = window.open('', '_blank', 'width=300,height=400')
    if (printWindow) {
      printWindow.document.write(ticketHTML)
      printWindow.document.close()
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close()
        }
      }, 1000)
    }
  }

  // Gérer le scan de carte
  const handleCardScan = useCallback(async (cardNumber: string,typeTag: string) => {
    if (state !== 'idle') return

    setState('scanning')
    setCardData(null)
    setError('')
    
    // Message d'accueil sur panneau LED (non bloquant)
   /*  sendMessagePanneau({ 
      color: 3, 
      front: 'small', 
      light: 0, 
      row1: "SCAN", 
      row2: "CARTE", 
      row3: "EN COURS", 
      row4: config.siteName, 
      bright: 71 
    }) */

    setTimeout(async () => {
      setState('processing')
      
      // Message de traitement sur panneau LED (non bloquant)
      /* sendMessagePanneau({ 
        color: 5, 
        front: 'small', 
        light: 0, 
        row1: "VERIFICATION", 
        row2: "CARTE", 
        row3: "EN COURS", 
        row4: config.siteName, 
        bright: 71 
      }) */
      
      // Appeler l'API Homintec
      const apiResult = await callHomintecAPI(cardNumber,typeTag)
      
      if (apiResult.success) {
        // Succès API - créer un objet card à partir des données API
        const apiCard: Card = {
          id: cardNumber,
          card_number: cardNumber,
          rfid_code: cardNumber,
          holder_name: `${apiResult.data.prenom} ${apiResult.data.nom}`,
          category: apiResult.data.targType,
          subscription_type: 'credits',
          balance: parseInt(apiResult.data.solde),
          is_active: apiResult.data.statutTarg === 'actived',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setCardData({ card: apiCard, message: 'Carte valide' })
        setState('success')
        
        // Message de succès sur panneau LED (non bloquant)
       /*  sendMessagePanneau({ 
          color: 2, 
          front: 'small', 
          light: 0, 
          row1: "CARTE", 
          row2: "VALIDE", 
          row3: "BONNE", 
          row4: "ROUTE", 
          bright: 71 
        })
         */
        // Actions en parallèle (sans sendMessagePanneau)
        await Promise.all([
          createTransaction(apiCard),
          openBarrier()
        ])
        
        // Mettre à jour le compteur de passages
        const count = await fetchTodayStats()
        setTodayPassages(count)
        
        // Imprimer ticket avec les données API
        setTimeout(() => printTicket(apiCard), 1000)
        
        // Reset après 3 secondes
        setTimeout(() => {
          setState('cooldown')
          setTimeout(() => {
            setState('idle')
            setCardData(null)
            // Message de retour à l'accueil (non bloquant)
           /*  sendMessagePanneau({ 
              color: 7, 
              front: 'small', 
              light: 0, 
              row1: "BIENVENU", 
              row2: "PEAGE", 
              row3: config.siteName, 
              row4: 'SAFER', 
              bright: 71 
            }) */
          }, 2000)
        }, 3000)
      } else {
        // Erreur API
        setError(apiResult.message)
        setState('error')
        
        // Message d'erreur sur panneau LED (non bloquant)
        /* sendMessagePanneau({ 
          color: 1, 
          front: 'small', 
          light: 0, 
          row1: "ERREUR", 
          row2: apiResult.message.substring(0, 20), 
          row3: "VEUILLEZ", 
          row4: "REESSAYER", 
          bright: 71 
        }) */
        
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
        
        // Reset après 2 secondes avec message d'accueil
        setTimeout(() => {
          setState('cooldown')
          setTimeout(() => {
            setState('idle')
            // Message de retour à l'accueil après erreur (non bloquant)
            /* sendMessagePanneau({ 
              color: 7, 
              front: 'small', 
              light: 0, 
              row1: "BIENVENU", 
              row2: "PEAGE", 
              row3: config.siteName, 
              row4: 'SAFER', 
              bright: 71 
            }) */
          }, 1000)
        }, 2000)
      }
    }, 1500)
  }, [state, callHomintecAPI, createTransaction, openBarrier, fetchTodayStats, printTicket, sendMessagePanneau, config])

  // Socket.IO connection for UHF tag detection
  useEffect(() => {
    // Connect to Socket.IO server with fallback options
    socketRef.current = io('http://192.168.1.84:5001', {
      transports: ['polling', 'websocket'],
      timeout: 5000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
    
    socketRef.current.on('connect', () => {
      console.log('🔌 Socket.IO connecté pour détection UHF')
    })
    
    socketRef.current.on('disconnect', () => {
      console.log('🔌 Socket.IO déconnecté')
    })
    
    // Listen for new UHF tag events
    socketRef.current.on('new_event', (data: { card: string, door: number, reader: string, type: number, time: string }) => {
      console.log('📡 Événement UHF reçu:', data)
      
      // Process UHF tag automatically if in idle state
      if (state === 'idle' && data.card) {
        console.log('🏷️ Tag UHF détecté:', data.card)
        handleCardScan(data.card, 'UHF')
      }
    })
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [state, handleCardScan])

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
          handleCardScan(cardNumber, 'CARTE')
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
        handleCardScan(cardNumber, 'CARTE')
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
        handleCardScan(cardNumber, 'CARTE')
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
      handleCardScan(cardNumber,'CARTE')
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  return (
    <div className="kiosk-screen relative overflow-hidden">
      {/* Animated Toll Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated road lines */}
        <div className="absolute inset-0">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
              style={{
                top: `${20 + i * 15}%`,
                animation: `moveRoadLine ${3 + i * 0.5}s linear infinite`,
                animationDelay: `${i * 0.3}s`
              }}
            />
          ))}
        </div>

        {/* Toll barrier animation */}
        <div className="absolute left-1/4 top-1/2 transform -translate-y-1/2">
          <div className="relative">
            {/* Barrier post */}
            <div className="w-4 h-32 bg-gradient-to-b from-gray-400 to-gray-600 rounded-lg" />
            {/* Barrier arm */}
            <div 
              className="absolute top-4 left-2 w-48 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full origin-left animate-barrier"
              style={{ animation: 'barrierMove 4s ease-in-out infinite' }}
            />
          </div>
        </div>

        {/* Second barrier - TRAFFIC LIGHT */}
        <div className="absolute right-1/4 top-1/2 transform -translate-y-1/2">
          <div className="relative flex flex-col items-center">
            {/* Traffic light pole */}
            <div className="w-3 h-20 bg-gradient-to-b from-gray-400 to-gray-600 rounded-lg" />
            
            {/* Traffic light box */}
            <div className="absolute -top-16 bg-gradient-to-b from-gray-700 to-gray-800 p-2 rounded-lg shadow-lg border border-gray-600">
              {/* Red light */}
              <div 
                className="w-8 h-8 rounded-full mb-2 shadow-inner animate-traffic-red"
                style={{ 
                  background: 'radial-gradient(circle at 30% 30%, #ff6666, #cc0000)',
                  boxShadow: '0 0 20px #ff0000, inset 0 0 10px rgba(0,0,0,0.5)',
                  animation: 'trafficRed 3s ease-in-out infinite'
                }}
              />
              {/* Green light */}
              <div 
                className="w-8 h-8 rounded-full shadow-inner animate-traffic-green"
                style={{ 
                  background: 'radial-gradient(circle at 30% 30%, #66ff66, #00cc00)',
                  boxShadow: '0 0 20px #00ff00, inset 0 0 10px rgba(0,0,0,0.5)',
                  animation: 'trafficGreen 3s ease-in-out infinite',
                  opacity: 0.3
                }}
              />
            </div>
          </div>
        </div>

        {/* Moving cars */}
        <div className="absolute bottom-1/4 left-0 w-full">
          {/* Car 1 */}
          <div 
            className="absolute bottom-0 animate-car1"
            style={{ animation: 'carMove1 8s linear infinite' }}
          >
            <div className="flex items-center space-x-1">
              <div className="w-12 h-6 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg" />
              <div className="w-2 h-4 bg-yellow-400/50 rounded-full animate-pulse" />
            </div>
          </div>
          {/* Car 2 */}
          <div 
            className="absolute bottom-8 animate-car2"
            style={{ animation: 'carMove2 12s linear infinite' }}
          >
            <div className="flex items-center space-x-1">
              <div className="w-14 h-7 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg" />
              <div className="w-2 h-4 bg-yellow-400/50 rounded-full animate-pulse" />
            </div>
          </div>
          {/* Car 3 - opposite direction */}
          <div 
            className="absolute bottom-16 right-0 animate-car3"
            style={{ animation: 'carMove3 10s linear infinite' }}
          >
            <div className="flex items-center space-x-1">
              <div className="w-2 h-4 bg-red-400/50 rounded-full animate-pulse" />
              <div className="w-10 h-5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Floating RFID/card icons */}
        {[...Array(6)].map((_, i) => (
          <div
            key={`rfid-${i}`}
            className="absolute animate-float"
            style={{
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 25}%`,
              animation: `float ${5 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.8}s`
            }}
          >
            <div className="w-8 h-5 bg-gradient-to-r from-cyan-400/20 to-indigo-400/20 rounded border border-cyan-400/30 flex items-center justify-center">
              <div className="w-4 h-3 border border-cyan-400/50 rounded-sm" />
            </div>
          </div>
        ))}

        {/* Glowing orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 glass-effect m-6 p-6 rounded-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-xl blur-lg animate-glow" />
              <div className="relative bg-white p-3 rounded-xl">
                <img src="/logo.png" alt="SAFER Logo" className="w-10 h-10" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">SAFER</h1>
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
                  <Wifi className={`w-5 h-5 text-green-400 ${isPinging ? 'animate-pulse' : ''}`} />
                  <span className="text-white text-sm font-medium">
                    {isPinging ? 'Ping...' : 'En ligne'}
                  </span>
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
              <div className="glass-effect p-8 rounded-3xl text-center">
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
                    placeholder="Scannez votre Tag"
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
              <div className="glass-effect p-8 rounded-3xl text-center">
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
              <div className="glass-effect p-8 rounded-3xl text-center">
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
              <div className="glass-effect p-8 rounded-3xl text-center">
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
              <div className="glass-effect p-8 rounded-3xl text-center">
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
              <div className="glass-effect p-8 rounded-3xl text-center">
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
      <footer className="relative z-10 glass-effect m-4 p-4 rounded-2xl">
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
