export type EventType = string
export type RawData = string
export type MessageData = string | Buffer

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataObject = any

export type Message = {
  type: string
  data: DataObject
}

export interface MessageOptions {
  delimiter: string
  rawBuffer: boolean
  encoding: BufferEncoding
}

function parseMessage(data: string): Message {
  try {
    return JSON.parse(data)
  } catch (err) {
    return {
      type: 'error',
      data: {
        message: 'Invalid JSON response format',
        err: err,
        response: data,
      },
    }
  }
}

export function parseMessages(data: string, options: MessageOptions): Message[] | undefined {
  return data.slice(-1) !== options.delimiter
    ? undefined
    : data.split(options.delimiter).slice(0, -1).map(parseMessage)
}

export function formatMessage(
  typeOrRawData: EventType | RawData,
  data: DataObject | undefined,
  options: MessageOptions
): MessageData {
  return options.rawBuffer
    ? Buffer.from(typeOrRawData, options.encoding)
    : JSON.stringify({ type: typeOrRawData, data }) + options.delimiter
}

export function makeRawBuffer(data: MessageData, options: MessageOptions): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data, options.encoding)
}
