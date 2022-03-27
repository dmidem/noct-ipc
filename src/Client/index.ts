import net from 'net'
import tls from 'tls'
import fs from 'fs'

import Config from '../Config'

import {
  EventType,
  RawData,
  DataObject,
  formatMessage,
  parseMessages,
  makeRawBuffer,
} from '../Message'

import { PatchedEventEmitter, TaskQueue, log, makePipePath, makeServerPath } from '../utils'

type ClientSocket = net.Socket | tls.TLSSocket

interface Client {
  socket: ClientSocket | undefined
  explicitlyDisconnected: boolean

  // constructor(config: Config, log: Log, id: string, path: string, port: number)
  emit(typeOrRawData: EventType | RawData, data?: DataObject): void
  connect(): void
}

function makePipeOptions(path) {
  return { path: makePipePath(path) }
}

function makeNetOptions(host, port, config) {
  const { localAddress, localPort, family, hints, lookup } = config.interface

  return {
    host,
    port,
    ...(localAddress ? { localAddress } : undefined),
    ...(localPort ? { localPort } : undefined),
    ...(family ? { family } : undefined),
    ...(hints ? { hints } : undefined),
    ...(lookup ? { lookup } : undefined),
  }
}

function makeTlsOptions(host, port, config) {
  if (!config.tls) {
    return makeNetOptions(host, port, config)
  }

  const { private: keyFileName, public: certFileName, trustedConnections: caFileNames } = config.tls

  return {
    ...makeNetOptions(host, port, config),
    ...(keyFileName ? { key: fs.readFileSync(keyFileName) } : undefined),
    ...(certFileName ? { cert: fs.readFileSync(certFileName) } : undefined),
    ...(caFileNames
      ? {
          ca: (typeof caFileNames === 'string' ? [caFileNames] : caFileNames).map(caFileName =>
            fs.readFileSync(caFileName)
          ),
        }
      : undefined),
  }
}

class Client extends PatchedEventEmitter {
  private config: Config
  private id: string
  private path: string
  private port: number

  private taskQueue = new TaskQueue()
  private retriesRemaining = 0
  private ipcBuffer = ''

  public socket: ClientSocket | undefined = undefined
  public explicitlyDisconnected = false

  private log(...args): void {
    log(this.config, ...args)
  }

  constructor(config: Config, id: string, path: string, port: number) {
    super()

    this.config = config
    this.id = id
    this.path = path
    this.port = port

    this.retriesRemaining = config.maxRetries || 0
  }

  public emit(typeOrRawData: EventType | RawData, data?: DataObject): boolean {
    const writeMessage = () => {
      this.log('Dispatching event to', this.id, this.path, ':', typeOrRawData, ',', data)

      if (!this.socket) {
        this.log('Error: client is not connected (', this.id, this.path, ')')
        return
      }

      this.socket.write(formatMessage(typeOrRawData, data, this.config))
    }

    if (this.config.sync) {
      this.taskQueue.add(writeMessage)
    } else {
      writeMessage()
    }

    return true
  }

  public isConnected() {
    return this.socket && !this.socket.destroyed
  }

  public disconnect(): Client {
    this.removeAllListeners()
    this.socket?.destroy?.()

    return this
  }

  public connect(): Client {
    const handleSocketError = err => {
      this.log('Error:', err)
      this.emitEvent('error', err)
    }

    const handleSocketConnect = () => {
      this.emitEvent('connect')
      this.retriesRemaining = this.config.maxRetries
      this.log('Retrying reset')
    }

    const handleSocketClose = () => {
      this.log(
        'Connection closed',
        this.id,
        this.path,
        this.retriesRemaining,
        'tries remaining of',
        this.config.maxRetries
      )

      if (this.config.stopRetrying || this.retriesRemaining < 1 || this.explicitlyDisconnected) {
        this.emitEvent('disconnect')

        this.log(this.config.id, 'Exceeded connection retry amount of or stopRetrying flag set')

        this.socket?.destroy()
        this.emitEvent('destroy')
        return
      }

      setTimeout(() => {
        if (!this.explicitlyDisconnected) {
          this.retriesRemaining--
          this.connect()
        }
      }, this.config.retry)

      this.emitEvent('disconnect')
    }

    const handleSocketData = data => {
      this.log('Received events')

      if (this.config.rawBuffer) {
        this.emitEvent('data', makeRawBuffer(data, this.config))

        if (this.config.sync) {
          this.taskQueue.next()
        }
        return
      }

      this.ipcBuffer = (this.ipcBuffer || '') + data.toString()

      const messages = parseMessages(this.ipcBuffer, this.config)

      if (!messages) {
        this.log('Messages are large, you may want to consider smaller messages')
        return
      }

      this.ipcBuffer = ''

      messages.forEach(({ type, data }) => {
        this.log('detected event', type, data)
        this.emitEvent(type, data)
      })

      if (this.config.sync) {
        this.taskQueue.next()
      }
    }

    this.log('Requested connection to', this.id, makeServerPath(this.path, this.port))

    if (!this.path) {
      this.log('Error:', this.id, 'client has not specified socket path it wishes to connect to')
      return this
    }

    if (!this.port) {
      this.log('Connecting client via IPC (Unix domain socket/Windows named pipe):', this.path)
      this.socket = net.connect(makePipeOptions(this.path))
    } else {
      if (!this.config.tls) {
        this.log('Connecting client via TCP to', this.path, this.port, this.config.interface)
        this.socket = net.connect(makeNetOptions(this.path, this.port, this.config))
      } else {
        this.log('Connecting client via TLS to', this.path, this.port, this.config.tls)
        this.socket = tls.connect(makeTlsOptions(this.path, this.port, this.config))
      }
    }

    this.socket
      .on('error', handleSocketError)
      .on('connect', handleSocketConnect)
      .on('close', handleSocketClose)
      .on('data', handleSocketData)
      .setEncoding(this.config.encoding)

    return this
  }
}

export { Client }

export function makeClient(config: Config, id: string, path: string, port: number): Client {
  return new Client(config, id, path, port)
}
