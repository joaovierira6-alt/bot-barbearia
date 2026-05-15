import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('Bot AppBarber Online'))
app.listen(PORT, () => console.log('Servidor rodando na porta', PORT))

const MEU_NUMERO = '5551981246261'

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['AppBarber', 'Chrome', '1.0.0']
    })

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MEU_NUMERO)
                console.log('================================')
                console.log('CODIGO DE PAREAMENTO:', code)
                console.log('================================')
            } catch (e) {
                console.log('Erro ao pedir codigo:', e.message)
            }
        }, 3000)
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('BOT APPBARBER CONECTADO COM SUCESSO')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    let sessoes = {}

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const numero = msg.key.remoteJid
        if (numero.endsWith('@g.us')) return

        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        const nome = msg.pushName || 'Cliente'
        const telefone = numero.replace('@s.whatsapp.net', '')

        if (texto.toLowerCase().match(/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/)) {
            sessoes[telefone] = { etapa: 'aviso' }
            await sock.sendMessage(numero, {
                text: 'Barbearia do Gui\n\nNosso sistema de agendamento automatico volta amanha.\n\nPor hoje, chama aqui no WhatsApp 51 98124-6261 que a gente marca pra ti.\n\nHorario: 9h as 19h'
            })
            return
        }

        if (sessoes[telefone]?.etapa === 'aviso') {
            await sock.sendMessage(numero, {
                text: 'Opa. Por hoje marca direto com a gente: 51 98124-6261\n\nAmanha o robo ja marca sozinho.'
            })
            await sock.sendMessage('5551981246261@s.whatsapp.net', {
                text: `CLIENTE CHAMOU\n\nNome: ${nome}\nNumero: +${telefone}\nMensagem: ${texto}`
            })
            delete sessoes[telefone]
        }
    })
}

startBot()
