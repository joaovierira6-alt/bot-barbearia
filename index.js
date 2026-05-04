const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const puppeteer = require('puppeteer')

const app = express()
const PORT = process.env.PORT || 3000
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Bot Barbearia Online')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor rodando na porta ' + PORT)
})

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './sessions' }),
  puppeteer: {
    headless: 'new',
    executablePath: puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
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
  console.log('Mensagem recebida:', msg.body)
  
  if (msg.body.toLowerCase() === 'menu') {
    msg.reply('Barbearia\n1 - Agendar\n2 - Precos\n3 - Horarios')
  }
})

client.initialize()

process.on('unhandledRejection', err => {
  console.error('Erro nao tratado:', err)
})
