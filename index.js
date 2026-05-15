import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('Bot Online'))
app.listen(PORT)

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, printQRInTerminal: false })

    if (!sock.authState.creds.registered) {
        const code = await sock.requestPairingCode('5551981246261')
        console.log('CODIGO DE PAREAMENTO:', code)
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) connectToWhatsApp()
        } else if (connection === 'open') {
            console.log('BOT CONECTADO')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text
        const numero = msg.key.remoteJid

        if (texto?.toLowerCase().match(/^(oi|olá|ola|menu)$/)) {
            await sock.sendMessage(numero, { text: 'Barbearia do Gui\n\nSistema volta amanha. Hoje chama 51 98124-6261' })
        }
    })
}

connectToWhatsApp()
