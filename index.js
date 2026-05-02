const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log('Escaneia o QR Code aí com o WhatsApp da barbearia!');
});

client.on('ready', () => {
    console.log('Bot da barbearia online!');
});

client.on('message', msg => {
    if (msg.body.toLowerCase() === 'menu') {
        msg.reply(💈 *Barbearia do João* 💈\n\nEscolha uma opção:\n\n1️⃣ - Ver horários disponíveis\n2️⃣ - Tabela de preços\n3️⃣ - Falar com atendente\n\nDigite o número da opção 👇);
    }
    
    if (msg.body === '1') {
        msg.reply('📅 Horários disponíveis hoje:\n\n• 14:00\n• 15:30\n• 17:00\n\nQual horário quer reservar?');
    }
    
    if (msg.body === '2') {
        msg.reply('💈 Tabela de Preços 💈\n\nCorte: R$ 35\nBarba: R$ 25\nCorte + Barba: R$ 55\nSobrancelha: R$ 15\nPezinho: R$ 10');
    }
    
    if (msg.body === '3') {
        msg.reply('Beleza! Já vou chamar o João aqui. Só um minuto 👊');
    }
});

client.initialize();
