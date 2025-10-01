interface SessionData {
  roomCode: string
  roomId: string
  playerId: string
  sessionToken: string
  isAdmin: boolean
  timestamp: number
}

export const SessionManager = {
  /**
   * Save session data to localStorage
   */
  save(data: Omit<SessionData, 'timestamp'>): void {
    try {
      const sessionData: SessionData = {
        ...data,
        timestamp: Date.now()
      }
      localStorage.setItem('artzooka_session', JSON.stringify(sessionData))
      console.log('Session saved:', { roomCode: data.roomCode, playerId: data.playerId })
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  },

  /**
   * Load session data from localStorage
   */
  load(): SessionData | null {
    try {
      const data = localStorage.getItem('artzooka_session')
      if (!data) return null
      
      const parsed = JSON.parse(data) as SessionData
      
      // Validate required fields
      if (!parsed.roomCode || !parsed.playerId || !parsed.sessionToken) {
        console.warn('Invalid session data found, clearing...')
        this.clear()
        return null
      }
      
      return parsed
    } catch (error) {
      console.error('Failed to load session:', error)
      this.clear()
      return null
    }
  },

  /**
   * Clear session data
   */
  clear(): void {
    try {
      localStorage.removeItem('artzooka_session')
      // Also clear legacy keys if they exist
      localStorage.removeItem('artzooka_room_code')
      localStorage.removeItem('artzooka_room_id')
      localStorage.removeItem('artzooka_player_id')
      localStorage.removeItem('artzooka_session_token')
      localStorage.removeItem('artzooka_is_admin')
      console.log('Session cleared')
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  },

  /**
   * Check if session is expired
   */
  isExpired(maxAge: number = 24 * 60 * 60 * 1000): boolean { // 24 hours default
    const session = this.load()
    if (!session) return true
    
    const age = Date.now() - session.timestamp
    return age > maxAge
  },

  /**
   * Check if session exists and is valid
   */
  hasValidSession(): boolean {
    const session = this.load()
    return session !== null && !this.isExpired()
  },

  /**
   * Get session data if valid, null otherwise
   */
  getValidSession(): SessionData | null {
    if (!this.hasValidSession()) {
      this.clear()
      return null
    }
    return this.load()
  }
}

// Canvas data management (separate from session)
export const CanvasManager = {
  /**
   * Save canvas data for a specific game
   */
  saveCanvas(gameId: string, canvasDataURL: string): void {
    try {
      const key = `artzooka_canvas_${gameId}`
      localStorage.setItem(key, canvasDataURL)
      console.log('Canvas saved for game:', gameId)
    } catch (error) {
      console.error('Failed to save canvas:', error)
    }
  },

  /**
   * Load canvas data for a specific game
   */
  loadCanvas(gameId: string): string | null {
    try {
      const key = `artzooka_canvas_${gameId}`
      return localStorage.getItem(key)
    } catch (error) {
      console.error('Failed to load canvas:', error)
      return null
    }
  },

  /**
   * Clear canvas data for a specific game
   */
  clearCanvas(gameId: string): void {
    try {
      const key = `artzooka_canvas_${gameId}`
      localStorage.removeItem(key)
      console.log('Canvas cleared for game:', gameId)
    } catch (error) {
      console.error('Failed to clear canvas:', error)
    }
  },

  /**
   * Clear all canvas data (cleanup)
   */
  clearAllCanvas(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('artzooka_canvas_')) {
          localStorage.removeItem(key)
        }
      })
      console.log('All canvas data cleared')
    } catch (error) {
      console.error('Failed to clear all canvas data:', error)
    }
  }
}



