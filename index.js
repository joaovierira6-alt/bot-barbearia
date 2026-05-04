const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

// 1. SERVIDOR HTTP PRO RENDER
const app = express()
const PORT = process.env.PORT || 3000
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Bot Barbearia Online')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor rodando na porta ' + PORT)
})

// 2. CONFIG DO WHATSAPP PRA RENDER
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './sessions' }),
  puppeteer: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote'
    ]
  }
})

client.on('qr', qr => {
  console.log('QR CODE DA BARBEARIA:')
  qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
  console.log('Bot da barbearia online!')
})

client.on('auth_failure', msg => {
  console.error('FALHA NA AUTENTICACAO:', msg)
})

client.on('disconnected', reason => {
  console.log('Cliente desconectado:', reason)
})

client.on('message', async msg => {
  console.log('Mensagem recebida:',
