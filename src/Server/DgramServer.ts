import dgram from 'dgram'

import BaseServer from './BaseServer'

import Config from '../Config'

import {
  EventType,
  RawData,
  DataObject,
  Message,
  MessageData,
  formatMessage,
  parseMessages,
} from '../Message'

import { makeServerPath } from '../utils'

export type UDPType = dgram.SocketType
export type ClientSocket = dgram.RemoteInfo
export type SocketServer = dgram.Socket

export class DgramServer extends BaseServer<ClientSocket, SocketServer> {
  private udpType: UDPType

  protected parseSocketMessages(socket: ClientSocket, data: string): Message[] | undefined {
    return parseMessages(data, this.config)
  }

  protected startServer() {
    this.log('Starting UDP', this.udpType, 'server on', makeServerPath(this.path, this.port))

    this.server = dgram.createSocket(this.udpType)

    this.setupSocket(this.server)
      .on('listening', () => {
        if (this.server) {
          this.server.on('message', (msg, rinfo) => {
            this.log('Received UDP message from', rinfo.address, rinfo.port)
            this.server?.emit('data', msg)
            this.handleSocketData(rinfo, msg)
          })
          this.handleServerBound()
        }
      })
      .bind(this.port, this.path)
  }

  constructor(config: Config, path: string, port: number, udpType: UDPType) {
    super(config, udpType === 'udp4' || path === '::1' ? '127.0.0.1' : path, port)
    this.udpType = udpType
  }

  public emit(socket: ClientSocket, typeOrRawData: EventType | RawData, data?: DataObject) {
    super.emit(socket, typeOrRawData, data)

    const write = (data: MessageData, socket: ClientSocket) => {
      const { port, address } = socket
      this.server?.send(data, 0, data.length, port, address, err => {
        if (err) {
          this.log('Error writing data to socket', err)
          this.emitEvent('error', err)
        }
      })
    }

    write(formatMessage(typeOrRawData, data, this.config), socket)
  }

  public broadcast(_typeOrRawData: EventType | RawData, _data?: DataObject) {
    this.log('Broadcast not supported for UDP server')
  }
}
