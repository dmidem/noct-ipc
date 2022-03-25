import os from 'os'
import { LookupFunction } from 'net'

import { LogConfig } from './utils'

const getIPType = (): string | undefined =>
  Object.entries(os.networkInterfaces())?.[0]?.[1]?.[0]?.family

export type TLSConfig = {
  private: string
  public: string
  trustedConnections: string[]
  dhparam: string | Buffer
}

export type ConnectOptions = {
  localAddress: string | undefined
  localPort: number | undefined
  family: number | undefined
  hints: number | undefined
  lookup: LookupFunction | undefined
}

export default class Config implements LogConfig {
  appspace = 'app.'
  socketRoot = '/tmp/'
  id = os.hostname()

  encoding: BufferEncoding = 'utf8'
  rawBuffer = false
  sync = false
  unlink = true

  delimiter = '\f'

  // LogConfig
  silent = false
  logDepth = 5
  logInColor = true
  logger = console.log.bind(console)

  maxConnections = 100
  retry = 500
  maxRetries = Infinity
  stopRetrying = false

  tls: TLSConfig | undefined = undefined
  networkHost = getIPType() === 'IPv6' ? '::1' : '127.0.0.1'
  networkPort = 8000

  readableAll = false
  writableAll = false

  interface: ConnectOptions = {
    localAddress: undefined,
    localPort: undefined,
    family: undefined,
    hints: undefined,
    lookup: undefined,
  }
}
