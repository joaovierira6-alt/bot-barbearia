const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const puppeteer = require('puppeteer')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const app = express()
const PORT = process.env.PORT || 3000
app.use(express.json())

// ============ CONFIG ============
const SALON_LOGIN = process.env.SALON_LOGIN
const SALON_SENHA = process.env.SALON_SENHA
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const BOT_PHONE_NUMBER = '5551981246261'
const ENDERECO_BARBEARIA = 'Rua 112, n° 28 - Guajuviras, Canoas'
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

const clientes = {}
// ================================

app.get('/', (req, res) => res.send('Bot Inteligente Online'))
app.listen(PORT, '0.0.0.0', () => console.log('Servidor rodando'))

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './sessions' }),
  puppeteer: {
    headless: 'new',
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
})

client.on('qr', qr => {
  console.log('QR gerado. Use o CÓDIGO DE PAREAMENTO abaixo para conectar.')
})

client.on('code', code => {
  console.log('>>> CÓDIGO DE PAREAMENTO: ' + code + ' <<<')
  console.log('WhatsApp -> Aparelhos conectados -> Conectar com número de telefone -> Digite o código acima')
})

client.on('ready', () => console.log('>>> BOT INTELIGENTE ONLINE <<< '))

async function entenderMensagem(texto, nomeCliente) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const prompt = `
Você é atendente da Barbearia do João em Guajuviras, Canoas.
Cliente: ${nomeCliente}
Mensagem: "${texto}"

Responda APENAS com JSON válido:
{
  "intencao": "agendar" | "horarios" | "preco" | "confirmar" | "outro",
  "horario": "15:30" ou null,
  "nome": "${nomeCliente}",
  "resposta": "texto natural pra mandar no WhatsApp"
}

Horários: 09:00 às 18:00.
"3 da tarde" = "15:00".
"meio dia" = "12:00".
Se não entender, intencao = "outro".
`
  try {
    const result = await model.generateContent(prompt)
    const textoResposta = result.response.text()
    const jsonMatch = textoResposta.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('JSON invalido')
  } catch (error) {
    console.log('Erro IA:', error.message)
    return { intencao: 'outro', horario: null, nome: nomeCliente, resposta: 'Não entendi direito. Quer ver os horários livres hoje? Manda "horarios".' }
  }
}

async function buscarHorariosSalonSoft() {
  let browser = null
  try {
    console.log('Buscando horarios no Salon Soft...')
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1366, height: 768 })

    await page.goto('https://www.appsalonsoft.com.br/#/login', { waitUntil: 'networkidle0', timeout: 60000 })
    await page.type('input[type="text"], input[type="tel"]', SALON_LOGIN)
    await page.type('input[type="password"]', SALON_SENHA)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle0' })

    await page.goto('https://www.appsalonsoft.com.br/#/agenda', { waitUntil: 'networkidle0' })
    await page.waitForTimeout(7000)

    const horarios = await page.evaluate(() => {
      const horasPadrao = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']
      const agendamentos = Array.from(document.querySelectorAll('.fc-event,.evento,[class*="agendamento"]'))
    .map(el => el.innerText)
    .join(' | ')
      return horasPadrao.filter(hora =>!agendamentos.includes(hora)).slice(0, 8)
    })

    await browser.close()
    console.log('Horários encontrados:', horarios)
    return horarios
  } catch (error) {
    console.log('Erro ao buscar horarios:', error.message)
    if (browser) await browser.close()
    return []
  }
}

async function agendarSalonSoft(horario, nomeCliente) {
  let browser = null
  try {
    console.log(`Agendando ${horario} para ${nomeCliente}`)
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1366, height: 768 })

    await page.goto('https://www.appsalonsoft.com.br/#/login', { waitUntil: 'networkidle0', timeout: 60000 })
    await page.type('input[type="text"], input[type="tel"]', SALON_LOGIN)
    await page.type('input[type="password"]', SALON_SENHA)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle0' })

    await page.goto('https://www.appsalonsoft.com.br/#/agenda', { waitUntil: 'networkidle0' })
    await page.waitForTimeout(5000)

    const clicou = await page.evaluate((h) => {
      const slots = Array.from(document.querySelectorAll('div, button, td'))
      const slot = slots.find(el => {
        const texto = el.innerText.trim()
        return texto === h &&!texto.includes('-')
      })
      if (slot) {
        slot.click()
        return true
      }
      return false
    }, horario)

    if (!clicou) throw new Error('Horário não encontrado ou já ocupado')

    await page.waitForTimeout(2000)
    const campoCliente = await page.$('input[placeholder*="cliente" i], input[formcontrolname="cliente"], input[name*="cliente" i]')
    if (!campoCliente) throw new Error('Campo de cliente não encontrado')

    await campoCliente.type(nomeCliente)
    await page.waitForTimeout(1000)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)

    const botaoSalvar = await page.$('button[type="submit"]')
    if (botaoSalvar) {
      await botaoSalvar.click()
    } else {
      await page.keyboard.press('Enter')
    }

    await page.waitForTimeout(3000)
    await browser.close()
    return { sucesso: true }

  } catch (error) {
    console.log('Erro ao agendar:', error.message)
    if (browser) await browser.close()
    return { sucesso: false, erro: error.message }
  }
}

setInterval(async () => {
  const agora = new Date()
  for (const telefone in clientes) {
    const ag = clientes[telefone]
    const horaAgendamento = new Date(ag.dataHora)
    const diffHoras = (agora - horaAgendamento) / 36e5

    if (diffHoras >= 2 && diffHoras < 3 &&!ag.posVendaEnviado) {
      await client.sendMessage(telefone, `Fala ${ag.nome}! Curtiu o corte de hoje?

Quando quiser voltar é só me chamar. Tamo junto!`)
      clientes[telefone].posVendaEnviado = true
      console.log('Pós-venda enviado para', ag.nome)
    }
  }
}, 1800000)

client.on('message', async msg => {
  if (msg.from.includes('@g.us')) return

  const telefone = msg.from
  const nomeContato = msg._data.notifyName || 'cliente'
  const texto = msg.body

  console.log(`MSG de ${nomeContato}: ${texto}`)

  const ia = await entenderMensagem(texto, nomeContato)

  if (ia.intencao === 'horarios') {
    await msg.reply('Pera, tô vendo os horários livres...')
    const horarios = await buscarHorariosSalonSoft()
    if (horarios.length > 0) {
      await msg.reply(`Horários livres hoje:

${horarios.map(h => `- ${h}`).join('\n')}

Qual tu quer?`)
    } else {
      await msg.reply('Não achei horário livre agora. Tenta mais tarde ou me fala outro dia.')
    }
    return
  }

  if (ia.intencao === 'agendar' && ia.horario) {
    await msg.reply(`Boa! Vou agendar ${ia.horario} pra ti. Só confirmando...`)
    const resultado = await agendarSalonSoft(ia.horario, ia.nome || nomeContato)

    if (resultado.sucesso) {
      const [h, m] = ia.horario.split(':')
      const dataHora = new Date()
      dataHora.setHours(parseInt(h), parseInt(m), 0, 0)

      clientes[telefone] = {
        nome: ia.nome || nomeContato,
        horario: ia.horario,
        dataHora: dataHora,
        posVendaEnviado: false
      }

      const hoje = new Date().toLocaleDateString('pt-BR')
      await msg.reply(`Agendado com sucesso!

Data: ${hoje}
Horário: ${ia.horario}
Cliente: ${ia.nome || nomeContato}

Te espero aqui na Barbearia do João!
${ENDERECO_BARBEARIA}

Se precisar cancelar, me avisa.`)
    } else {
      await msg.reply(`Deu erro: ${resultado.erro}

Esse horário deve ter sido ocupado. Manda "horarios" que te mostro os livres.`)
    }
    return
  }

  await msg.reply(ia.resposta)
})

client.initialize({
  pairingCode: true,
  phoneNumber: BOT_PHONE_NUMBER
})
