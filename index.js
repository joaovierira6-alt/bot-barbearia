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
    console.log('Escaneia o QR Code com o WhatsApp da barbearia');
});

client.on('ready', () => {
    console.log('Bot da barbearia online');
});

client.on('message', msg => {
    if (msg.body.toLowerCase() === 'menu') {
        msg.reply('Barbearia do Joao\n\nEscolha uma opcao:\n\n1 - Ver horarios disponiveis\n2 - Tabela de precos\n3 - Falar com atendente\n\nDigite o numero da opcao');
    }
    
    if (msg.body === '1') {
        msg.reply('Horarios disponiveis hoje:\n\n- 14:00\n- 15:30\n- 17:00\n\nQual horario quer reservar?');
    }
    
    if (msg.body === '2') {
        msg.reply('Tabela de Precos\n\nCorte: R$ 35\nBarba: R$ 25\nCorte + Barba: R$ 55\nSobrancelha: R$ 15\nPezinho: R$ 10');
    }
    
    if (msg.body === '3') {
        msg.reply('Beleza. Ja vou chamar o Joao aqui. So um minuto');
    }
});

client.initialize();
