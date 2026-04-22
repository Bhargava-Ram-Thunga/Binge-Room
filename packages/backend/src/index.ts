import dotenv from 'dotenv'
import { parseEnv } from './env.js'

dotenv.config({ path: '../../.env' })
const env = parseEnv(process.env)

console.log(
  `BingeRoom backend starting (${env.NODE_ENV}) — REST :${env.PORT_REST} · WS :${env.PORT_WS}`,
)
