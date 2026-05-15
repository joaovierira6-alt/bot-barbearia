import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay } from '@whiskeysockets/baileys'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('Bot AppBarber Online'))
app.listen(PORT, () => console.log('Servidor rodando na porta', PORT))

const MEU_NUMERO = '5551981246261'
let tentativas = 0

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['AppBarber', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 2000,
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (connection === 'open') {
            console.log('✅ BOT APPBARBER CONECTADO COM SUCESSO')
            tentativas = 0
        }

        if (connection === 'close') {
            const codigo = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = codigo !== DisconnectReason.loggedOut
            console.log('❌ Conexão fechada. Código:', codigo, '| Reconectando:', shouldReconnect)
            if (shouldReconnect) {
                await delay(3000)
                startBot()
            }
        }

        // Pede o código de pareamento assim que conectar ao WA
        if (connection === 'connecting' || update.isNewLogin) {
            if (!sock.authState.creds.registered && tentativas < 3) {
                tentativas++
                console.log(`Tentativa ${tentativas} de pedir código...`)
                await delay(5000)
                try {
                    const code = await sock.requestPairingCode(MEU_NUMERO)
                    console.log('================================')
                    console.log('🔑 CODIGO DE PAREAMENTO:', code)
                    console.log('================================')
                } catch (e) {
                    console.log('Erro ao pedir codigo:', e.message)
                }
            }
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
