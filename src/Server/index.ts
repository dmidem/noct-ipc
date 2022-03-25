import { NetServer } from './NetServer'
import { DgramServer, UDPType } from './DgramServer'

export type { UDPType }

export type Server = NetServer | DgramServer

export function makeServer(config, path, port, udpType: UDPType): Server {
  return udpType ? new DgramServer(config, path, port, udpType) : new NetServer(config, path, port)
}
