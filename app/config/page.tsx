'use client'

import { useState, useEffect } from 'react'
import { 
  Settings,
  Server,
  MapPin,
  Building
} from 'lucide-react'

interface ConfigData {
  serverAddress: string
  serverPort: string
  panelAddress: string
  panelPort: string
  siteName: string
  lane: string
  kioskAddress: string
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigData>({
    serverAddress: '',
    serverPort: '',
    panelAddress: '',
    panelPort: '',
    siteName: '',
    lane: '',
    kioskAddress: '',
  })
  const [configError, setConfigError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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

  // Handle configuration save
  const handleConfigSave = () => {
    console.log('Saving config:', config)
    setConfigError('')
    setSuccessMessage('')
    
    // Validation
    if (!config.serverAddress || !config.serverPort || !config.panelAddress || 
        !config.panelPort || !config.siteName || !config.lane || !config.kioskAddress) {
      setConfigError('Tous les champs sont obligatoires')
      return
    }

    // Port validation
    const serverPortNum = parseInt(config.serverPort)
    const panelPortNum = parseInt(config.panelPort)
    
    if (isNaN(serverPortNum) || serverPortNum < 1 || serverPortNum > 65535) {
      setConfigError('Port serveur invalide (1-65535)')
      return
    }
    
    if (isNaN(panelPortNum) || panelPortNum < 1 || panelPortNum > 65535) {
      setConfigError('Port panneau invalide (1-65535)')
      return
    }

    // Save to localStorage
    try {
      localStorage.setItem('kioskConfig', JSON.stringify(config))
      console.log('Config saved to localStorage successfully')
      setSuccessMessage('Configuration enregistrée avec succès!')
    } catch (error) {
      console.error('Error saving to localStorage:', error)
      setConfigError('Erreur lors de la sauvegarde')
    }
  }

  // Handle configuration input changes
  const handleConfigChange = (field: keyof ConfigData, value: string) => {
    console.log('Config change:', field, '=', value)
    setConfig(prev => ({ ...prev, [field]: value }))
    setConfigError('')
    setSuccessMessage('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-8">
      {/* Background animated elements */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="glass-effect p-8 rounded-3xl">
          {/* Header */}
          <div className="flex items-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-xl blur-lg animate-glow" />
              <div className="relative bg-gradient-to-r from-cyan-500 to-indigo-500 p-4 rounded-xl">
                <Settings className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="ml-6">
              <h1 className="text-3xl font-bold text-white">Configuration de la Borne</h1>
              <p className="text-cyan-300">Paramètres de connexion et du site</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Server Configuration */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Server className="w-6 h-6 mr-3 text-cyan-400" />
                Configuration Serveur
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">
                  Adresse Serveur
                </label>
                <input
                  type="text"
                  value={config.serverAddress}
                  onChange={(e) => handleConfigChange('serverAddress', e.target.value)}
                  className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                  placeholder="ex: 192.168.1.100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">
                  Port Serveur
                </label>
                <input
                  type="text"
                  value={config.serverPort}
                  onChange={(e) => handleConfigChange('serverPort', e.target.value)}
                  className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                  placeholder="ex: 8080"
                />
              </div>
            </div>

            {/* Panel Configuration */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <MapPin className="w-6 h-6 mr-3 text-cyan-400" />
                Configuration Panneau
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">
                  Adresse Panneau
                </label>
                <input
                  type="text"
                  value={config.panelAddress}
                  onChange={(e) => handleConfigChange('panelAddress', e.target.value)}
                  className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                  placeholder="ex: 192.168.1.101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">
                  Port Panneau
                </label>
                <input
                  type="text"
                  value={config.panelPort}
                  onChange={(e) => handleConfigChange('panelPort', e.target.value)}
                  className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                  placeholder="ex: 9000"
                />
              </div>
            </div>

          

            {/* Site Configuration */}
            <div className="space-y-6 md:col-span-2">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Building className="w-6 h-6 mr-3 text-cyan-400" />
                Configuration du Site
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    Nom du Site
                  </label>
                  <select
                    value={config.siteName}
                    onChange={(e) => handleConfigChange('siteName', e.target.value)}
                    className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                  >
                    <option value="" className="bg-slate-800">Sélectionner un site</option>
                    <option value="DAVIE" className="bg-slate-800">DAVIE</option>
                    <option value="AKEPEDO" className="bg-slate-800">AKEPEDO</option>
                    <option value="AKEPE" className="bg-slate-800">AKEPE</option>
                    <option value="TABLIGLO" className="bg-slate-800">TABLIGLO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    Voie
                  </label>
                  <select
                    value={config.lane}
                    onChange={(e) => handleConfigChange('lane', e.target.value)}
                    className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                  >
                    <option value="" className="bg-slate-800">Sélectionner une voie</option>
                    <option value="GATE-ALLER" className="bg-slate-800">GATE-ALLER</option>
                    <option value="GATE-RETOUR" className="bg-slate-800">GATE-RETOUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">
                    IP de la Borne (Kiosk)
                  </label>
                  <input
                    type="text"
                    value={config.kioskAddress}
                    onChange={(e) => handleConfigChange('kioskAddress', e.target.value)}
                    className="w-full p-4 border border-cyan-400/50 rounded-xl bg-white/10 text-white placeholder-cyan-300 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 transition-all"
                    placeholder="ex: 192.168.1.50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          {configError && (
            <div className="mt-8 bg-red-500/20 border border-red-400/30 rounded-xl p-4">
              <p className="text-red-300 font-medium">{configError}</p>
            </div>
          )}

          {successMessage && (
            <div className="mt-8 bg-green-500/20 border border-green-400/30 rounded-xl p-4">
              <p className="text-green-300 font-medium">{successMessage}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => {
                localStorage.removeItem('kioskConfig')
                setConfig({
                  serverAddress: '',
                  serverPort: '',
                  panelAddress: '',
                  panelPort: '',
                  siteName: '',
                  lane: '',
                  kioskAddress: '',
                })
                setSuccessMessage('Configuration effacée!')
                console.log('Configuration cleared')
              }}
              className="px-6 py-3 text-red-300 hover:text-red-400 transition-all"
            >
              Effacer la configuration
            </button>
            
            <div className="flex space-x-4">
              <a
                href="/"
                className="px-6 py-3 border border-cyan-400/50 text-cyan-300 rounded-xl hover:bg-white/10 transition-all"
              >
                Retour à la borne
              </a>
              <button
                onClick={handleConfigSave}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
              >
                Enregistrer la configuration
              </button>
            </div>
          </div>

          {/* Debug Info */}
         {/*  <div className="mt-8 p-6 bg-black/30 rounded-xl">
            <h3 className="text-cyan-300 text-sm font-medium mb-3">Debug - Configuration actuelle:</h3>
            <pre className="text-white text-xs font-mono">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div> */}
        </div>
      </div>
    </div>
  )
}
