import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot AppBarber Online'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }),
    puppeteer: {
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const MEU_NUMERO = '5551981246261@c.us';

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('code', code => console.log('CODIGO PAREAMENTO:', code));
client.on('ready', () => console.log('BOT APPBARBER ONLINE'));

let sessoes = {};

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contato = await msg.getContact();
    const telefone = contato.number;
    const nome = contato.pushname || 'Cliente';

    // Ignora grupos
    if (chat.isGroup) return;

    if (msg.body.toLowerCase().match(/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/)) {
        sessoes[telefone] = { etapa: 'aviso' };
        await chat.sendStateTyping();
        return msg.reply('Barbearia do Gui\n\nNosso sistema de agendamento automatico volta amanha.\n\nPor hoje, chama aqui no WhatsApp 51 98124-6261 que a gente marca pra ti.\n\nHorario de atendimento: 9h as 19h');
    }

    // Se a pessoa mandar qualquer coisa depois do "oi"
    if (sessoes[telefone]?.etapa === 'aviso') {
        await chat.sendStateTyping();
        await msg.reply('Opa. Por hoje marca direto com a gente: 51 98124-6261\n\nAmanha o robo ja marca sozinho.');

        // Te avisa no privado
        client.sendMessage(MEU_NUMERO, `CLIENTE CHAMOU\n\nNome: ${nome}\nNumero: +${telefone}\nMensagem: ${msg.body}`);

        delete sessoes[telefone];
    }
});

client.initialize();
