import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys'
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
        browser: Browsers.ubuntu('Chrome'),
        mobile: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: false,
        defaultQueryTimeoutMs: 0,
    })

    if (!sock.authState.creds.registered) {
        console.log('Aguardando 3s para solicitar pareamento...')
        await new Promise(r => setTimeout(r, 3000))
        try {
            const code = await sock.requestPairingCode(MEU_NUMERO)
            console.log('================================')
            console.log('CODIGO DE PAREAMENTO:', code)
            console.log('COLA NO WHATSAPP EM 20 SEGUNDOS')
            console.log('================================')
        } catch (e) {
            console.log('ERRO AO PEDIR CODIGO:', e.message)
            console.log('Reiniciando em 5s...')
            setTimeout(startBot, 5000)
            return
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            console.log('Conexao fechada. Codigo:', statusCode)
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('Deslogado. Apague a pasta auth_info_baileys e reconecte.')
            } else {
                console.log('Reconectando em 3s...')
                setTimeout(startBot, 3000)
            }
        } else if (connection === 'open') {
            console.log('BOT APPBARBER CONECTADO COM SUCESSO')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    let sessoes = {}

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') return
        if (msg.key.remoteJid.endsWith('@g.us')) return

        const numero = msg.key.remoteJid
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
