import axios from 'axios'

const defaultBase = 'http://127.0.0.1:8080' // prefer IPv4 to avoid localhost/IPv6 stalls
export const http = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE || defaultBase,
  timeout: 15000,
  withCredentials: false
})
