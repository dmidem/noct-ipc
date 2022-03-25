import net from 'net'
import tls from 'tls'
import fs from 'fs'
import path from 'path'

import BaseServer from './BaseServer'

import { EventType, RawData, DataObject, Message, formatMessage, parseMessages } from '../Message'

import { makePipePath, makeServerPath } from '../utils'

export type ClientSocket = (net.Socket | tls.TLSSocket) & { id?: string; ipcBuffer?: string }
export type SocketServer = net.Server | tls.Server

function makeTlsOptions(tlsConfig) {
  if (!tlsConfig) {
    return {}
  }

  const readCAFiles = caFileNames =>
    (typeof caFileNames === 'string' ? [caFileNames] : caFileNames).map(caFileName =>
      fs.readFileSync(caFileName)
    )

  return {
    ...(tlsConfig.dhparam && { dhparam: fs.readFileSync(tlsConfig.dhparam) }),

    key: fs.readFileSync(
      tlsConfig.private || path.join(__dirname, '../local-node-ipc-certs/private/server.key')
    ),

    cert: fs.readFileSync(
      tlsConfig.public || path.join(__dirname, '../local-node-ipc-certs/server.pub')
    ),

    ...(tlsConfig.trustedConnections && { ca: readCAFiles(tlsConfig.trustedConnections) }),
  }
}

export class NetServer extends BaseServer<ClientSocket, SocketServer> {
  private sockets: ClientSocket[] = []

  protected parseSocketMessages(socket: ClientSocket, data: string): Message[] | undefined {
    socket.ipcBuffer = (socket.ipcBuffer || '') + data

    const messages = parseMessages(socket.ipcBuffer, this.config)

    if (!messages) {
      return
    }

    socket.ipcBuffer = ''

    // Only set the socket id if it is specified
    const id = messages.map(({ data: { id } }) => id).slice(-1)[0]
    if (id) {
      socket.id = id
    }

    return messages
  }

  protected handleServerClose(): void {
    super.handleServerClose()

    this.sockets.forEach(socket => {
      socket.destroy()
      this.log('Socket disconnected:', socket.id)
      this.emitEvent('socket.disconnected', socket, socket.id)
    })
  }

  protected startServer(): void {
    const handleClientConnection = (socket: ClientSocket) => {
      this.log('Socket connection to server detected')

      this.setupSocket(socket)
        .setEncoding(this.config.encoding)
        .on('data', data => this.handleSocketData(socket, data))
      this.sockets.push(socket)

      this.emitEvent('connect', socket)
    }

    this.log(
      'Starting',
      this.port ? 'NET' : 'IPC',
      this.config.tls ? 'TLS' : 'TCP',
      'server on',
      makeServerPath(this.path, this.port)
    )

    this.server = this.config.tls
      ? tls.createServer(makeTlsOptions(this.config.tls), handleClientConnection)
      : net.createServer(handleClientConnection)

    this.server.on('error', err => {
      this.log('Server error', err)
      this.emitEvent('error', err)
    })

    this.server.maxConnections = this.config.maxConnections

    if (this.port) {
      this.server.listen(this.port, this.path, this.handleServerBound.bind(this))
    } else {
      this.server.listen(
        {
          path: makePipePath(this.path),
          readableAll: this.config.readableAll,
          writableAll: this.config.writableAll,
        },
        this.handleServerBound.bind(this)
      )
    }
  }

  public emit(socket: ClientSocket, typeOrRawData: EventType | RawData, data?: DataObject): void {
    super.emit(socket, typeOrRawData, data)

    socket?.write(formatMessage(typeOrRawData, data, this.config))
  }

  public broadcast(typeOrRawData: EventType | RawData, data?: DataObject): void {
    this.log(
      'Broadcasting event to all known sockets listening to',
      makeServerPath(this.path, this.port),
      '(',
      typeOrRawData,
      data,
      ')'
    )

    const messageData = formatMessage(typeOrRawData, data, this.config)
    this.sockets.forEach(socket => socket.write(messageData))
  }
}
