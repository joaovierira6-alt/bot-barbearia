import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000

app.get('/', (req, res) => res.send('Bot Studio Fischborn Online'))

app.listen(PORT, () => console.log('Servidor rodando na porta', PORT))

const MEU_NUMERO = '5551981246261'
const LINK_AVALIACAO = 'https://g.page/r/CYwPM0VxHzWgEBM/review'
const LINK_AGENDAMENTO = 'https://sites.appbarber.com.br/studiofischborn-appc?service=1222466&employee=25978001'

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
        await new Promise(r => setTimeout(r, 3000))
        const code = await sock.requestPairingCode(MEU_NUMERO)
        console.log('CODIGO:', code)
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) {
                setTimeout(startBot, 3000)
            }
        } else if (connection === 'open') {
            console.log('BOT STUDIO FISCHBORN CONECTADO')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    let sessoes = {}

    function agendarMensagemAvaliacao(numero, nome) {
        setTimeout(async () => {
            try {
                await sock.sendMessage(numero, {
                    text: `E ai ${nome}, tudo certo com o corte?\n\nObrigado por utilizar dos nossos servicos. Agradecemos de coracao!\n\nSe possivel deixar sua avaliacao no Google pra fortalecer a STUDIO FISCHBORN:\n${LINK_AVALIACAO}\n\nValeu demais, te esperamos na proxima!`
                })
            } catch (e) {
                console.log('Erro ao enviar avaliacao:', e)
            }
        }, 7200000)
    }

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') return
        if (msg.key.remoteJid.endsWith('@g.us')) return

        const numero = msg.key.remoteJid
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        const textoLower = texto.toLowerCase().trim()
        const nome = msg.pushName || 'Cliente'
        const telefone = numero.replace('@s.whatsapp.net', '')

        if (textoLower.match(/^(oi|olá|ola|bom dia|boa tarde|boa noite|menu)$/)) {
            sessoes[telefone] = { etapa: 'perguntar_servico', nome }
            await sock.sendMessage(numero, {
                text: `Ola tudo bem?\nSou o bot da barbearia STUDIO FISCHBORN\n\nAgende online aqui: ${LINK_AGENDAMENTO}\n\nOu fale comigo pra marcar:\n\n1 - Corte\n2 - Barba\n3 - Corte + Barba`
            })
            return
        }

        const sessao = sessoes[telefone]
        if (!sessao) return

        if (sessao.etapa === 'perguntar_servico') {
            let servico = ''
            if (texto === '1') servico = 'Corte'
            else if (texto === '2') servico = 'Barba'
            else if (texto === '3') servico = 'Corte + Barba'
            else {
                await sock.sendMessage(numero, { text: 'Digite 1, 2 ou 3 pra escolher o servico' })
                return
            }

            sessao.servico = servico
            sessao.etapa = 'perguntar_horario'
            await sock.sendMessage(numero, {
                text: `${servico} anotado.\n\nQual horario deseja?\n\nMe fala o dia e a hora. Ex: Sexta 16h ou 25/05 14:00`
            })
            return
        }

        if (sessao.etapa === 'perguntar_horario') {
            sessao.horarioDesejado = texto
            sessao.etapa = 'aguardando_confirmacao'
            await sock.sendMessage(numero, {
                text: `Confirmacao de agendamento\n\nVoce escolheu ${sessao.servico} para o horario ${texto}\n\nPodemos confirmar?\n\n1 - Sim\n2 - Nao, quero mudar`
            })

            await sock.sendMessage(MEU_NUMERO + '@s.whatsapp.net', {
                text: `PEDIDO NOVO\n\nCliente: ${sessao.nome}\nTel: +${telefone}\nServico: ${sessao.servico}\nHorario: ${texto}`
            })
            return
        }

        if (sessao.etapa === 'aguardando_confirmacao') {
            if (texto === '1' || textoLower.includes('sim')) {
                await sock.sendMessage(numero, {
                    text: `Pedido recebido!\n\nVamos confirmar a disponibilidade e ja te retorno.\n\nObrigado por escolher a STUDIO FISCHBORN!`
                })

                agendarMensagemAvaliacao(numero, sessao.nome)

                await sock.sendMessage(MEU_NUMERO + '@s.whatsapp.net', {
                    text: `CLIENTE CONFIRMOU\n\nNome: ${sessao.nome}\nTelefone: +${telefone}\nServico: ${sessao.servico}\nHorario: ${sessao.horarioDesejado}\n\nMarca no AppBarber. Avaliacao em 2h.`
                })
                delete sessoes[telefone]
            } else {
                sessao.etapa = 'perguntar_horario'
                await sock.sendMessage(numero, {
                    text: `Tranquilo! Qual outro horario tu deseja?`
                })
            }
            return
        }
    })
}

startBot()
